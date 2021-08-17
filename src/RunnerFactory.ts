import { TestEvent, TestInfo, TestRunFinishedEvent, TestRunStartedEvent, TestSuiteEvent } from "vscode-test-adapter-api"
import { IRunner } from "./RunnerManager"
import { spawn } from "child_process"
import { parse, join } from "path"
import { debug, EventEmitter, Uri, workspace, WorkspaceFolder } from "vscode"
import * as settings from "./settings"
import { decorationBuilder } from './DecorationBuilder'

export const createTestRunner = (node: TestInfo, eventEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>) : IRunner => {
  
  const runTest = () : Promise<void> => {
    return new Promise<void>((resolve) => {
      const tuple = getWorkspaceAndFileName(node)

      if(!tuple.workspaceFolder) {
        eventEmitter.fire({ type: "test", test: node.id, state: "skipped" });
        resolve();
        return
      }

      const process = spawn('node', [
        join('.', 'node_modules', 'react-scripts', 'bin', 'react-scripts.js'),
        'test', 
        tuple.fileName,
        '--testNamePattern=' + fixPattern(node),
        '--watchAll=false', 
        '--no-cache',
        '--json'
      ], {
        cwd: tuple.workspaceFolder.uri.fsPath
      })

      let result : string = ''
      process.stdout.on('data', (data) => {
        result += data.toString()
      })

      process.on('close', (code) => {
        if(code == 0) {
          eventEmitter.fire({ type: "test", test: node.id, state: "passed" });
        }
        else {
          eventEmitter.fire({ type: "test", test: node.id, state: "failed", decorations: [ decorationBuilder.build(tuple.fileName, result) ] });
        }
        resolve();
      })
    })
  }
  
  eventEmitter.fire({ type: "test", test: node.id, state: "running", decorations: [] });

  return {
    node,
    execute: runTest
  }
}

export const createDebugRunner = (node: TestInfo) : IRunner => {
  
  const runDebugger = () : Promise<void> => {
    return new Promise<void>((resolve) => {
      const tuple = getWorkspaceAndFileName(node)

    if(!tuple.workspaceFolder) {
      resolve()
      return
    }

    debug.startDebugging(tuple.workspaceFolder, {
      name: 'react-scripts-test-adapter',
      type: 'node',
      request: 'launch',
      args: [
        'test',
        tuple.fileName,
        '-t=' + fixPattern(node),
        '--bail',
        '--runInBand',
        '--no-cache',
        '--watchAll=false'
      ],
      protocol: 'inspector',
      console: settings.getDebugOutput(),
      internalConsoleOptions: "neverOpen",
      runtimeExecutable: join('${workspaceFolder}', 'node_modules', '.bin', 'react-scripts')
    });
    })
  }

  return {
    node,
    execute: runDebugger
  }
}

const getWorkspaceAndFileName = (node: TestInfo): {fileName: string, workspaceFolder: WorkspaceFolder | undefined} => {
  if(!node.file) {
    return { fileName : '', workspaceFolder: undefined }
  }

  const fileName = parse(node.file).base
  const workSpaceFolder = workspace.getWorkspaceFolder(Uri.file(node.file));
  return { fileName , workspaceFolder: workSpaceFolder }

}

function fixPattern(node: TestInfo) {
  let value = node.label;
  do {
    value = value.replace(' ', '\\s');
  }while(value.indexOf(' ') !== -1);
  return value + "$";
}
