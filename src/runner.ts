import { debug, Uri, workspace } from "vscode"
import {spawn} from "child_process"
import { TestInfo } from "vscode-test-adapter-api"

export const  TestRunner = async (node: TestInfo) : Promise<'skipped'|'passed'|'failed'> => {
  return new Promise<'skipped'|'passed'|'failed'>((resolve, reject) => {
    if(!node.file) {    
      resolve('skipped');
      return;
    }

    const file = Uri.file(node.file);
    const workspaceFolder = workspace.getWorkspaceFolder(file);
    if(!workspaceFolder) {
      resolve('skipped');
      return
    }

    const lua = spawn('node', [
      '.\\node_modules\\react-scripts\\bin\\react-scripts.js', 
      'test', 
      '--testNamePattern=' + fixPattern(node),
      '--watchAll=false', 
      '--no-cache'
    ], {
      cwd: workspaceFolder.uri.fsPath
    })

    lua.on('close', (code) => {
      if(code == 0) {
        resolve('passed');
      }
      else {
        resolve('failed');
      }
    })
  })
}


export const  DebugRunner = async (node: TestInfo) : Promise<'skipped'|'passed'|'failed'> => {
  return new Promise<'skipped'|'passed'|'failed'>((resolve, reject) => {
    if(!node.file) {    
      resolve('skipped');
      return;
    }
    
    const file = Uri.file(node.file);
    const workspaceFolder = workspace.getWorkspaceFolder(file);
      
    debug.startDebugging(workspaceFolder, {
      name: 'react-scripts-test-adapter',
      type: 'node',
      request: 'launch',
      args: [
        'test',
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
