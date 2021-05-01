import { TestEvent, TestInfo, TestRunFinishedEvent, TestRunStartedEvent, TestSuiteEvent, TestSuiteInfo } from "vscode-test-adapter-api";
import * as settings from "./settings";
import {relative} from "path";
import {readFile} from "fs";
import {promisify} from "util";
import {DebugRunner, TestRunner} from './runner'
import { EventEmitter, Uri, workspace } from "vscode";

const reactScriptsSuite: TestSuiteInfo = {
  type: "suite",
  id: "0",
  label: "ReactScriptUnit",
  children: []
};

let testId = 1;

export async function loadTests(): Promise<TestSuiteInfo> {
  const testGlob = settings.getTestGlob();
  const files = await (await workspace.findFiles(testGlob)).sort((a,b) => a.path < b.path ? 1 : -1);

  reactScriptsSuite.children = []
  
  for (const file of files) { 
    const workspaceFolder = workspace.getWorkspaceFolder(file);
		if (!workspaceFolder) {
			console.error("Failed to find workspaceFolder");
			continue;
		}

    const suiteId = relative(workspaceFolder.uri.fsPath, file.fsPath)
    const testSuite: TestSuiteInfo = {
			type: "suite",
			id: suiteId,
			label: suiteId,
			children: []
		};
    
    const testEncoding = settings.getTestEncoding();
    const readFilePromise = promisify(readFile);
		const content = await readFilePromise(file.fsPath, { encoding: testEncoding }) as string
    parseTests(content, file, testSuite);
    reactScriptsSuite.children.push(testSuite);
  }

  return reactScriptsSuite;
}



function parseTests(content: string, file: Uri, testSuite: TestSuiteInfo) {
  const testRegex = settings.getTestRegex();
  let match: RegExpExecArray | null;
  do {
    match = testRegex.exec(content);
    if (match && match.groups && match.groups["test"]) {
      const test: TestInfo = {
        type: "test",
        id: testId.toString(),
        label: match.groups["test"],
        file: file.fsPath
      };
      testSuite.children.push(test);
      testId++;
    }
  } while (match);
}

export async function runTests(tests: string[], testStatesEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>): Promise<void> {
    for (const suiteOrTestId of tests.reverse()) {
      const node = findNode(reactScriptsSuite, suiteOrTestId);
      if (node) {
        await runNode(node, testStatesEmitter);
      }
    }
}

function findNode(searchNode: TestSuiteInfo | TestInfo, id: string): TestSuiteInfo | TestInfo | undefined {
	if (searchNode.id === id) {
		return searchNode;
	} else if (searchNode.type === 'suite') {
		for (const child of searchNode.children) {
			const found = findNode(child, id);
			if (found) return found;
		}
	}
	return undefined;
}

async function runNode(node: TestSuiteInfo | TestInfo, testStatesEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>, debugMode = false): Promise<void> {
	if (node.type === 'suite') {
		for (const child of node.children) {
			await runNode(child, testStatesEmitter, debugMode);
		}
	} else {
    if(debugMode) {
      debugTest(node, testStatesEmitter);
    }
    else {
      runTest(node, testStatesEmitter);
    }
    testStatesEmitter.fire(<TestEvent>{ type: "test", test: node.id, state: "running" });
	}
}

async function runTest(node: TestInfo, testStatesEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>): Promise<void> {
  testStatesEmitter.fire(<TestEvent>{ type: "test", test: node.id, state: "running" });
  const result = await TestRunner(node);
  testStatesEmitter.fire(<TestEvent>{ type: "test", test: node.id, state: result });
}

export async function debugTests(tests: string[], testStatesEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>): Promise<void> {
  for (const suiteOrTestId of tests) {
    const node = findNode(reactScriptsSuite, suiteOrTestId);
    if (node) {
      await runNode(node, testStatesEmitter, true);
    }
  }
}

async function debugTest(node: TestInfo, testStatesEmitter: EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>): Promise<void> {
  const result = await DebugRunner(node);
  testStatesEmitter.fire(<TestEvent>{ type: "test", test: node.id, state: result });
}