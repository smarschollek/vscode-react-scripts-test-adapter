import * as vscode from 'vscode';
import { TestHub, testExplorerExtensionId } from 'vscode-test-adapter-api';
import { Log, TestAdapterRegistrar } from 'vscode-test-adapter-util';
import { ReactScriptsAdapter } from './adapter';

export async function activate(context: vscode.ExtensionContext) {
	const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];
		
	// create a simple logger that can be configured with the configuration variables
	// `exampleExplorer.logpanel` and `exampleExplorer.logfile`
	const log = new Log('reactScriptsTestAdapter', workspaceFolder, 'React Script Test Adapter');
	context.subscriptions.push(log);
	
	// get the Test Explorer extension
	const testExplorerExtension = vscode.extensions.getExtension<TestHub>(testExplorerExtensionId);
	
	if (testExplorerExtension) {
		const reactScripts = await checkForReactScripts();
		
		if(!reactScripts) {
			log.info(`react-scripts ${reactScripts ? '' : 'not '}found`);
			return
		}

		const testHub = testExplorerExtension.exports;
		
		// this will register an ExampleTestAdapter for each WorkspaceFolder
		context.subscriptions.push(new TestAdapterRegistrar(
			testHub,
			workspaceFolder => new ReactScriptsAdapter(workspaceFolder, log),
			log
		));
	} else {
		log.info(`Test Explorer ${testExplorerExtension ? '' : 'not '}found`);
	}
} 

const checkForReactScripts = async () : Promise<boolean> => {
  const files = await vscode.workspace.findFiles('*node_modules/.bin/react-scripts');
  return files.length > 0
}
