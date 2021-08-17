import { EventEmitter, Uri } from "vscode";
import { RetireEvent, TestEvent, TestInfo, TestRunFinishedEvent, TestRunStartedEvent, TestSuiteEvent, TestSuiteInfo } from "vscode-test-adapter-api";
import * as settings from "./settings";
import {relative} from "path";
import { WorkspaceWatcher } from "./WorkspaceWatcher";
import {runnerManager} from "./RunnerManager";
import {createDebugRunner, createTestRunner} from "./RunnerFactory";

import {DescribeBlock, IParseResults, ItBlock, parse, ParsedNode} from 'jest-editor-support'

export class TestManager {

  private _suite: TestSuiteInfo;
  private _testId: number;
  private _root: TestSuiteInfo;

  constructor(private workspaceWatcher: WorkspaceWatcher, private retireEmiter: EventEmitter<RetireEvent>) {  
    this._suite = {
      type: "suite",
      id: 'root',
      label: 'root',
      children: []
    };

    workspaceWatcher.onTestsRetired((file) => {
      const node = this.findNodeByFile(this._suite, file.fsPath);
      if(node) {
        this.retireEmiter.fire({tests: [node.id]})
      }
    })
    
    this._root = this.createSuiteInfo(this.workspaceWatcher.workspace.name, this.workspaceWatcher.workspace.uri, 0);
    this._suite.children.push(this._root)
    this._testId = 1;
  }
  
  public async loadTests(): Promise<TestSuiteInfo> {
    this._root.children = [];

    const flattenList = settings.getFlattenList()

    for (const file of this.workspaceWatcher.getTestFiles()) {      
      const infos = await this.parseFileContent(file);
      if(flattenList) {
        this._root.children = this._root.children.concat(infos)
      }
      else {
        const suiteId = relative(this.workspaceWatcher.workspace.uri.fsPath, file.fsPath);
        const suite = this.createSuiteInfo(suiteId, file, 0);
        suite.children = infos
        this._root.children.push(suite);
      }
    }

    return this._suite;
  }

  public async runTests(tests: string[], eventEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>): Promise<void> {
    eventEmitter.fire({ type: 'started', tests: tests });

    for (const suiteOrTestId of tests) {
      const node = this.findNodeById(this._suite, suiteOrTestId);
      if (node) {
        this.parseNodeTree(node, eventEmitter)
      }
    }

    runnerManager.start()

    eventEmitter.fire({ type: 'finished' });
  }

  private parseNodeTree(node : TestInfo | TestSuiteInfo, eventEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>) {
    if (node.type === 'suite') {
      for (const child of node.children) {
        this.parseNodeTree(child, eventEmitter);
      }
    } else {
      runnerManager.addRunner(createTestRunner(node, eventEmitter))
    }
  }

  public async debugTests(tests: string[]): Promise<void> {
    for (const suiteOrTestId of tests) {
      const node = this.findNodeById(this._suite, suiteOrTestId);
      if (node) {
        await this.debugTest(node);
      }
    }
  }

  private findNodeByFile(searchNode: TestSuiteInfo | TestInfo, file: string): TestSuiteInfo | TestInfo | undefined {
    if (searchNode.file === file) {
      return searchNode;
    } else if (searchNode.type === 'suite') {
      for (const child of searchNode.children) {
        const found = this.findNodeByFile(child, file);
        if (found) return found;
      }
    }
    return undefined;
  }

  private findNodeById(searchNode: TestSuiteInfo | TestInfo, id: string): TestSuiteInfo | TestInfo | undefined {
    if (searchNode.id === id) {
      return searchNode;
    } else if (searchNode.type === 'suite') {
      for (const child of searchNode.children) {
        const found = this.findNodeById(child, id);
        if (found) return found;
      }
    }
    return undefined;
  }

  private async parseFileContent(file: Uri): Promise<Array<TestInfo|TestSuiteInfo>> {   
    const result = parse(file.fsPath)    
    return this.buildTree(result, file);
  }
  
  private buildTree(parseResult: IParseResults, file: Uri) : Array<TestInfo|TestSuiteInfo> {
    const result:Array<TestInfo|TestSuiteInfo> = []
    
    const info = this.convertParsedNode(parseResult.root, file)
    if(info) {
      if((info as TestSuiteInfo).children) {
        return (info as TestSuiteInfo).children
      }
      else {
        result.push(info)
      }
    }
    
    return result;
  }

  private convertParsedNode(node: ParsedNode, file: Uri): TestInfo|TestSuiteInfo|undefined {
    if(node.type === "root") {
      const info = this.createSuiteInfo('root', file, 0)
      node.children?.forEach(child => {
        const childInfo = this.convertParsedNode(child, file)
        if(childInfo) {
          info.children.push(childInfo)
        }
      })
      return info;
    }
    
    if(node.type === "describe") {
      const info = this.createSuiteInfo((node as DescribeBlock).name, file, node.start.line - 1)
      node.children?.forEach(child => {
        const childInfo = this.convertParsedNode(child, file)
        if(childInfo) {
          info.children.push(childInfo)
        }
      })
      return info;
    }
    
    if(node.type === "it") {
      return this.createTestInfo((node as ItBlock).name, file, node.start.line - 1)
    }

    return undefined
  } 

  private createTestInfo(label: string, file: Uri, line: number) : TestInfo {
    return {
      		type: "test",
      		id: (this._testId++).toString(),
      		label: label,
      		file: file.fsPath,
          line: line
      	};
  }

  private createSuiteInfo(suiteId: string, file: Uri, line: number) : TestSuiteInfo {
    return {
      		type: "suite",
      		id: suiteId,
      		label: suiteId,
          file: file.fsPath,
      		children: [],
          line: line,
          debuggable: false
      	};
  }

  private async debugTest(node: TestSuiteInfo | TestInfo): Promise<void> {  
    if (node.type !== 'suite') {
      await createDebugRunner(node).execute()
	  }
  }
}