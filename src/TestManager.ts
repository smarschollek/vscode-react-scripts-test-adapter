import { EventEmitter, Uri } from "vscode";
import { RetireEvent, TestEvent, TestInfo, TestRunFinishedEvent, TestRunStartedEvent, TestSuiteEvent, TestSuiteInfo } from "vscode-test-adapter-api";
import * as settings from "./settings";
import {relative} from "path";
import {readFile} from "fs";
import {promisify} from "util";
import { DebugRunner, TestRunner } from "./runner";
import { WorkspaceWatcher } from "./WorkspaceWatcher";

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
    
    this._root = this.createSuiteInfo(this.workspaceWatcher.workspace.name, this.workspaceWatcher.workspace.uri);
    this._suite.children.push(this._root)
    this._testId = 1;
  }
  
  public async loadTests(): Promise<TestSuiteInfo> {
    this._root.children = [];

    for (const file of this.workspaceWatcher.getTestFiles()) { 
      const suiteId = relative(this.workspaceWatcher.workspace.uri.fsPath, file.fsPath);
      const suite = this.createSuiteInfo(suiteId, file);

      suite.children = await this.parseFileContent(file);
      if(suite.children.length > 0) {
        this._root.children.push(suite);
      }
    }

    return this._suite;
  }

  public async runTests(tests: string[], testStatesEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>): Promise<void> {
    for (const suiteOrTestId of tests) {
      const node = this.findNodeById(this._suite, suiteOrTestId);
      if (node) {
        await this.runTest(node, testStatesEmitter);
      }
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

  private async parseFileContent(file: Uri): Promise<TestInfo[]> {
    const testEncoding = settings.getTestEncoding();
    const testRegex = settings.getTestRegex();
    const readFilePromise = promisify(readFile);
		const content = await readFilePromise(file.fsPath, { encoding: testEncoding }) as string;
    const lines = content.split('\n');
    
    const result = [];

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const match = testRegex.exec(line);
      if(match && match.groups && match.groups["test"]) {
        result.push(this.createTestInfo(this._testId++, file, match.groups["test"], index ));
      }
    }

    return result;
  }
  
  private createTestInfo(testId: number, file: Uri, label: string, lineNumber: number) : TestInfo {
    return {
      		type: "test",
      		id: testId.toString(),
      		label: label,
      		file: file.fsPath,
          line: lineNumber
      	};
  }

  private createSuiteInfo(suiteId: string, file: Uri) : TestSuiteInfo {
    return {
      		type: "suite",
      		id: suiteId,
      		label: suiteId,
          file: file.fsPath,
      		children: []
      	};
  }

  private async runTest(node: TestSuiteInfo | TestInfo, testStatesEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>): Promise<void> {  
    if (node.type === 'suite') {
		  for (const child of node.children) {
			  this.runTest(child, testStatesEmitter);
		  }
	  } else {
      testStatesEmitter.fire(<TestEvent>{ type: "test", test: node.id, state: "running" });
      const result = await TestRunner(node);
      testStatesEmitter.fire(<TestEvent>{ type: "test", test: node.id, state: result });
	  }
  }

  private async debugTest(node: TestSuiteInfo | TestInfo): Promise<void> {  
    if (node.type === 'suite') {
		  // for (const child of node.children) {
			//   await this.debugTest(child, testStatesEmitter);
		  // }
	  } else {
      await DebugRunner(node);      
	  }
  }
}