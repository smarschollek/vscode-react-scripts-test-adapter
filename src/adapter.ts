import * as vscode from 'vscode';
import { TestAdapter, TestLoadStartedEvent, TestLoadFinishedEvent, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent, RetireEvent, TestSuiteInfo } from 'vscode-test-adapter-api';
import { Log } from 'vscode-test-adapter-util';

import ProjectManager from './ProjectManager'
import TestManager from './TestManager'

export class ReactScriptsAdapter implements TestAdapter {

	private disposables: { dispose(): void }[] = [];	
	private readonly testsEmitter = new vscode.EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
	private readonly testStatesEmitter = new vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>();
	private readonly autorunEmitter = new vscode.EventEmitter<void>();
	private readonly retireEmitter = new vscode.EventEmitter<RetireEvent>();

	private projectManager: ProjectManager;
	private suite: TestSuiteInfo | undefined;
	private testManager: TestManager;

	get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> { return this.testsEmitter.event; }
	get testStates(): vscode.Event<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent> { return this.testStatesEmitter.event; }
	get autorun(): vscode.Event<void> | undefined { return this.autorunEmitter.event; }
	get retire(): vscode.Event<RetireEvent> { return this.retireEmitter.event; }

	constructor(public readonly workspace: vscode.WorkspaceFolder,private readonly log: Log) {
		
		const runnerOutputChannel = vscode.window.createOutputChannel(`React Script Test Adapter (${workspace.name})`)

		this.log.info('Initializing react-scripts test adapter');		

		this.projectManager = new ProjectManager(this.workspace, this.log)
		this.projectManager.onFilesChanged(() => this.load())
		this.testManager = new TestManager(this.testStatesEmitter, this.workspace, this.log, runnerOutputChannel)

		this.disposables.push(this.testsEmitter);
		this.disposables.push(this.testStatesEmitter);
		this.disposables.push(this.autorunEmitter);	
	}

	async load(): Promise<void> {
		this.log.info('Loading tests...');		
		this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });
		this.suite = await this.projectManager.loadTestSuite()
		this.testsEmitter.fire(<TestLoadFinishedEvent>{ type: 'finished', suite: this.suite });
	}

	async run(tests: string[]): Promise<void> {
		if(this.testManager.isRunning) {
			this.log.info('Test run is already in progress');
			return
		}

		this.log.info('Running tests... ' + JSON.stringify(tests));
		this.testManager.runTests(tests, this.suite!)
	}

	async debug(tests: string[]): Promise<void> {
		this.testManager.debugTests(tests, this.suite!)
	}

	cancel(): void {
		this.testManager.cancelTests()
		this.log.info('Cancel all running test sessions')
	}

	dispose(): void {		this.cancel();
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables = [];
	}
}
