import { Uri, workspace } from "vscode"
import {parse} from "path"
import {spawn} from "child_process"

export const  Runner = async (file: Uri) : Promise<boolean> => {
  return new Promise<boolean>((resolve, reject) => {
    const workspaceFolder = workspace.getWorkspaceFolder(file);

    if(!workspaceFolder) {
      resolve(false);
      return
    }

    const cleanedFileName = parse(file.fsPath).base;

    const lua = spawn('node', ['.\\node_modules\\react-scripts\\bin\\react-scripts.js', 'test', cleanedFileName, '--watchAll=false', '--no-cache' ], {
      cwd: workspaceFolder.uri.fsPath
    })

    lua.on('close', (code) => {
      resolve(code == 0);
    })
  })
}