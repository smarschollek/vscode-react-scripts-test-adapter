import { EventEmitter, Uri, workspace } from "vscode";
import { TestEvent, TestInfo, TestRunFinishedEvent, TestRunStartedEvent, TestSuiteEvent, TestSuiteInfo } from "vscode-test-adapter-api";
import * as settings from "./settings";
import {relative} from "path";
import {readFile} from "fs";
import {promisify} from "util";
import { DebugRunner, TestRunner } from "./runner";

export class TestManager {

  private _suite: TestSuiteInfo;
  private _testId: number;
  // private readonly _testFileSuffices: string[] = ['.test.js', '.test.jsx', '.test.ts', '.test.tsx'];

  constructor() {
    this._suite = {
      type: "suite",
      id: "root",
      label: "root",
      children: []
    };
    
    this._testId = 1;
  }

  public async loadTests(): Promise<TestSuiteInfo> {
    this._suite.children = [];
    const testGlob = settings.getTestGlob();
  	const files = await (await workspace.findFiles(testGlob)).sort((a,b) => a.path < b.path ? 1 : -1);
    for (const file of files) { 
      const workspaceFolder = workspace.getWorkspaceFolder(file);
      
      if (!workspaceFolder) {
        console.error("Failed to find workspaceFolder");
        continue;
      }

      const suiteId = relative(workspaceFolder.uri.fsPath, file.fsPath);
      const suite = this.createSuiteInfo(suiteId);

      suite.children = await this.parseFileContent(file);
      if(suite.children.length > 0) {
        this._suite.children.push(suite);
      }
  }

  return this._suite;
  }

  public async runTests(tests: string[], testStatesEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>): Promise<void> {
    for (const suiteOrTestId of tests) {
      const node = this.findNode(this._suite, suiteOrTestId);
      if (node) {
        await this.runTest(node, testStatesEmitter);
      }
    }
  }

  public async debugTests(tests: string[], testStatesEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>): Promise<void> {
    for (const suiteOrTestId of tests) {
      const node = this.findNode(this._suite, suiteOrTestId);
      if (node) {
        await this.debugTest(node, testStatesEmitter);
      }
    }
  }

  // public isTestFile(uri: Uri): boolean {
  //   this._testFileSuffices.some(suffix => {
  //     return uri.fsPath.endsWith(suffix)
  //   })

  //   return false;
  // }

  // public isApplicationFile(uri: Uri):boolean {
	// 	const workspaceFolder = workspace.getWorkspaceFolder(uri);
	// 	return !!workspaceFolder
	// }

  // public findMatchingId(codeFile: string): string {
  //     const fileName = parse(codeFile).base;
  //     const testFile = this.getMatchingTestFile(fileName);

  //     return "";
  // }

  // private getMatchingTestFile(file: string) : string | undefined {
  //   if(file.endsWith('.tsx'))    
  //     return file.replace('.tsx', '.test.tsx');
  //   if(file.endsWith('.ts'))    
  //     return file.replace('.ts', '.test.ts');
  //   if(file.endsWith('.jsx'))    
  //     return file.replace('.jsx', '.test.jsx');
  //   if(file.endsWith('.js'))    
  //     return file.replace('.js', '.test.js');

  //   return undefined
  // }

  private findNode(searchNode: TestSuiteInfo | TestInfo, id: string): TestSuiteInfo | TestInfo | undefined {
    if (searchNode.id === id) {
      return searchNode;
    } else if (searchNode.type === 'suite') {
      for (const child of searchNode.children) {
        const found = this.findNode(child, id);
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

  private createSuiteInfo(suiteId: string) : TestSuiteInfo {
    return {
      		type: "suite",
      		id: suiteId,
      		label: suiteId,
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

  private async debugTest(node: TestSuiteInfo | TestInfo, testStatesEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>): Promise<void> {  
    if (node.type === 'suite') {
		  // for (const child of node.children) {
			//   await this.debugTest(child, testStatesEmitter);
		  // }
	  } else {
      testStatesEmitter.fire(<TestEvent>{ type: "test", test: node.id, state: "running" });
      const result = await DebugRunner(node);
      testStatesEmitter.fire(<TestEvent>{ type: "test", test: node.id, state: result });
	  }
  }
}