import { EventEmitter, WorkspaceFolder, debug, OutputChannel } from "vscode";
import { TestEvent, TestInfo, TestRunFinishedEvent, TestRunStartedEvent, TestSuiteEvent, TestSuiteInfo } from "vscode-test-adapter-api";
import RunnerManager, { IRunner } from './RunnerManager'
import { join, parse } from "path"
import { spawn, ChildProcessWithoutNullStreams } from "child_process"
import { JestTotalResults, TestFileAssertionStatus, TestReconciler } from "jest-editor-support";
import { Log } from "vscode-test-adapter-util";
import { getDebugOutput, getUseCraco } from './settings'

type RunnerInfo = {
  id: string,
  file?: string,
  runAll: boolean,
  testIds: string[]
}

export default class TestManager {
  private runnerManager : RunnerManager
  private testReconciler: TestReconciler
  private isRunningFlag: boolean

  public get isRunning() { return this.isRunningFlag }

  public constructor(private eventEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>, private workspace: WorkspaceFolder, private log: Log, private outputChannel: OutputChannel) {
    this.runnerManager = new RunnerManager()
    this.testReconciler = new TestReconciler()
    this.isRunningFlag = false
  }

  public async runTests(tests: string[], testSuiteInfo: TestSuiteInfo) {
    const nodes : TestSuiteInfo[] = this.parseTestsToNodes(tests, testSuiteInfo)
    const infos : RunnerInfo[] = this.parseNodesToRunnerInfo(tests, nodes)
    
    this.isRunningFlag = true;
    this.eventEmitter.fire({ type: 'started', tests: tests });

    for(const info of infos) {
      this.runnerManager.addRunner(this.createRunner(info))  
    }
    
    this.runnerManager.onComplete(() => {
      this.eventEmitter.fire({  type: 'finished' })
      this.isRunningFlag = false;
    })

    this.outputChannel.clear()
    this.runnerManager.start()    
    
  }

  private parseNodesToRunnerInfo(tests: string[], nodes: TestSuiteInfo[]) : RunnerInfo[] {
    const infos : RunnerInfo[] = []
    for(const node of nodes) {
      infos.push(this.buildRunnerInfo(tests, node))
    }  

    return infos
  }

  private parseTestsToNodes(tests: string[], testSuiteInfo: TestSuiteInfo) : TestSuiteInfo[] {
    const nodes : TestSuiteInfo[] = []
    for(const test of tests) {
      const node = this.getTestSuites(test, testSuiteInfo)
      if(node) {
        if(!nodes.includes(node)) {
          nodes.push(node)
        }
      }
    }

    return nodes
  }

  public cancelTests() {
    this.runnerManager.cancel()
    this.eventEmitter.fire({  type: 'finished' })
  }

  public debugTests(tests: string[], testSuiteInfo: TestSuiteInfo) {
    const nodes : TestSuiteInfo[] = this.parseTestsToNodes(tests, testSuiteInfo)
    const infos : RunnerInfo[] = this.parseNodesToRunnerInfo(tests, nodes)
    
    infos.forEach(info => {
      debug.startDebugging(this.workspace, {
        name: 'react-scripts-test-adapter',
        type: 'node',
        request: 'launch',
        args: [
          'test',
          parse(info.file!).base,
          '--testNamePattern=' + info.testIds.map(x => (`^${x}$`)).join('|'),
          '--bail',
          '--runInBand',
          '--no-cache',
          '--watchAll=false'
        ],
        protocol: 'inspector',
        console: getDebugOutput(),
        internalConsoleOptions: "neverOpen",
        runtimeExecutable: this.getRuntimeExecutable()
      });
    })
  }

  private getRuntimeExecutable() {
    if(getUseCraco()) {
      return join('${workspaceFolder}', 'node_modules', '.bin', 'craco')
    } else {
      return join('${workspaceFolder}', 'node_modules', '.bin', 'react-scripts')
    }
  }

  private getRunnerExecutable() {
    if(getUseCraco()) {
      return join('.', 'node_modules', '@craco', 'craco','bin', 'craco.js')
    } else {
      return join('.', 'node_modules', 'react-scripts', 'bin', 'react-scripts.js')
    }
  }

  private createRunner(info : RunnerInfo) : IRunner {
    let process : ChildProcessWithoutNullStreams

    const cancelTest = () => {
      process.kill()
    }

    const runTest = () : Promise<void> => {
      return new Promise<void>((resolve) => {
        
        const args = [
          this.getRunnerExecutable(),
          'test'
        ]
        if(info.file) {
          args.push(parse(info.file).base)
        }

        if(!info.runAll) {
          args.push('--testNamePattern=' + info.testIds.map(x => (`^${x}$`)).join('|'))
        }

        args.push('--watchAll=false')
        args.push('--no-cache')
        args.push('--json')
        args.push('--testLocationInResults')

        process = spawn('node', args, {
          cwd: this.workspace.uri.fsPath
        })
        
        this.log.info('Run: ' + args.join(' '))

        let stdout = ""
        process.stdout.on('data', (data) => {
          stdout += data.toString()
        })

        process.stderr.on('data', (data) => {
          this.outputChannel.append(this.trimAnsi(data.toString()))
        })

        process.on('close', (code: number | null) => {
          if(code === null) {
            resolve();
            return
          }

          const totalResult : JestTotalResults = JSON.parse(stdout)
          const assertionStates : TestFileAssertionStatus[] = this.testReconciler.updateFileWithJestStatus(totalResult)
          
          assertionStates.forEach(assertionState => {
            assertionState.assertions?.forEach(assertion => {
              if(assertion.status === 'KnownFail' || assertion.status === 'KnownSuccess') {
                const state = this.parseToTestState(assertion.status)
                const event : TestEvent = { type: "test", test: assertion.fullName, state: state}
    
                if(state === "failed") {
                  event.tooltip = this.trimAnsi(assertion.shortMessage)
                  event.decorations = [
                    {
                      line: Number(assertion.line) - 1,
                      message: this.trimAnsi(assertion.message),
                      hover: this.trimAnsi(assertion.shortMessage)
                    }
                  ]
                }

                this.eventEmitter.fire(event)
              }
            })
          })
          resolve();
        })
      })
    }
    
    info.testIds.forEach(x => this.eventEmitter.fire({ type: "test", test: x, state: "running" }))

    return {
      execute: runTest,
      cancel: cancelTest
    }
  }

  private trimAnsi(text?: string): string {
    if(text) {
      return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
    }
    return ''
  }

  private parseToTestState(jestState: string) : 'passed' | 'failed' {
    if(jestState === 'KnownSuccess') {
      return "passed"
    }
    return "failed"
  }

  private buildRunnerInfo(tests: string[], node: TestSuiteInfo) : RunnerInfo {
    const result : RunnerInfo = {
      id: node.id,
      file: node.file,
      runAll: tests.length === 1 && tests[0] === node.id,
      testIds: this.getTestIds(tests, node.children)
    } 

    return result;
  }

  private getTestSuites (test: string, node: TestSuiteInfo | TestInfo) : TestSuiteInfo | undefined  {
    if (node.id === test) {
      return node as TestSuiteInfo;
    } else if (node.type === 'suite') {
      for (const child of node.children) {
        const found = this.getTestSuites(test, child);
        if (found) {
          return child as TestSuiteInfo;
        }
      }
    }

    return undefined;
  }

  private getTestIds (tests: string[], nodes: (TestSuiteInfo|TestInfo)[]) : string[] {
    const result : string[] = []
    
    if(!nodes) {
      console.log('nodes are undefined - this prevents the tests from running.');
      return [];
    }

    for(const node of nodes) {
      if(node.type === "test") {
        if(tests.find(x => node.id.includes(x)) || tests.includes('root')) {
          result.push(node.id)
        }
      } else if (node.type === "suite") {
        this.getTestIds(tests, node.children).forEach(x => result.push(x))
      }
      
    }

    return result;
  }
}