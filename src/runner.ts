import { debug, Uri, workspace, WorkspaceFolder } from "vscode"
import {spawn} from "child_process"
import {parse} from 'path'
import { TestInfo } from "vscode-test-adapter-api"

export const  TestRunner = async (node: TestInfo) : Promise<'skipped'|'passed'|'failed'> => {
  return new Promise<'skipped'|'passed'|'failed'>((resolve, reject) => {
    const tuple = getWorkspaceAndFileName(node)

    if(!tuple.workspaceFolder) {
      resolve('skipped');
      return
    }

    const process = spawn('node', [
      '.\\node_modules\\react-scripts\\bin\\react-scripts.js', 
      'test', 
      tuple.fileName,
      '--testNamePattern=' + fixPattern(node),
      '--watchAll=false', 
      '--no-cache'
    ], {
      cwd: tuple.workspaceFolder.uri.fsPath
    })

    process.on('close', (code) => {
      if(code == 0) {
        resolve('passed');
      }
      else {
        resolve('failed');
      }
    })
  })
}

const getWorkspaceAndFileName = (node: TestInfo): {fileName: string, workspaceFolder: WorkspaceFolder | undefined} => {
    if(!node.file) {
      return { fileName : '', workspaceFolder: undefined }
    }

    const fileName = parse(node.file).base
    const workSpaceFolder = workspace.getWorkspaceFolder(Uri.file(node.file));
    return { fileName , workspaceFolder: workSpaceFolder }

}

export const DebugRunner = async (node: TestInfo) : Promise<'skipped'|'passed'|'failed'> => {
  return new Promise<'skipped'|'passed'|'failed'>((resolve, reject) => {
    const tuple = getWorkspaceAndFileName(node)

    if(!tuple.workspaceFolder) {
      resolve('skipped');
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
      console: 'integratedTerminal',
      internalConsoleOptions: 'neverOpen',
      runtimeExecutable: `\${workspaceFolder}\\node_modules\\.bin\\react-scripts`,
    });
    
    debug.onDidTerminateDebugSession((debugSession) => {
      resolve('skipped');
    })
  })
}

function fixPattern(node: TestInfo) {
  let value = node.label;
  do {
    value = value.replace(' ', '\\s');
  }while(value.indexOf(' ') !== -1);
  return value + "$";
}
