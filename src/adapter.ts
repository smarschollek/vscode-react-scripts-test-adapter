import * as vscode from 'vscode';
import { TestAdapter, TestLoadStartedEvent, TestLoadFinishedEvent, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent, RetireEvent, TestSuiteInfo } from 'vscode-test-adapter-api';
import { Log } from 'vscode-test-adapter-util';
import { TestManager } from './TestManager';

export class ReactScriptsAdapter implements TestAdapter {

	private disposables: { dispose(): void }[] = [];
	private loadedTests: TestSuiteInfo | undefined;

	private readonly testsEmitter = new vscode.EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
	private readonly testStatesEmitter = new vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>();
	private readonly autorunEmitter = new vscode.EventEmitter<void>();
	private readonly retireEmitter = new vscode.EventEmitter<RetireEvent>();
	private readonly testManager = new TestManager();

	get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> { return this.testsEmitter.event; }
	get testStates(): vscode.Event<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent> { return this.testStatesEmitter.event; }
	get autorun(): vscode.Event<void> | undefined { return this.autorunEmitter.event; }
	get retire(): vscode.Event<RetireEvent> { return this.retireEmitter.event; }

	constructor(public readonly workspace: vscode.WorkspaceFolder,private readonly log: Log) {
		this.log.info('Initializing react-scripts test adapter');

		this.disposables.push(this.testsEmitter);
		this.disposables.push(this.testStatesEmitter);
		this.disposables.push(this.autorunEmitter);
		this.loadedTests = undefined;
		
		vscode.workspace.onDidSaveTextDocument(document => {
			this.load();
		});
	}

	async load(): Promise<void> {
		this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });
  	this.loadedTests = await this.testManager.loadTests();
		this.testsEmitter.fire(<TestLoadFinishedEvent>{ type: 'finished', suite: this.loadedTests });
	}

	async run(tests: string[]): Promise<void> {
		this.testManager.runTests(tests, this.testStatesEmitter);
	}


	async debug(tests: string[]): Promise<void> {
		this.testManager.debugTests(tests, this.testStatesEmitter);
	}


	cancel(): void {
		//throw new Error("Method not implemented.");
	}

	dispose(): void {		this.cancel();
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables = [];
	}
}
