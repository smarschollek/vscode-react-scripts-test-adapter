import { RelativePattern, Uri, workspace as ws, WorkspaceFolder, Event, EventEmitter } from "vscode";
import { TestInfo, TestSuiteInfo } from "vscode-test-adapter-api";
import { Log } from "vscode-test-adapter-util";
import * as settings from "./settings";
import FileParser from './FileParser'

export default class ProjectManager {
  private filesChanged: EventEmitter<void>
  private parser: FileParser

  get onFilesChanged(): Event<void> { return this.filesChanged.event; }
  
  public constructor(public readonly workspace: WorkspaceFolder,private readonly log: Log)  {
    this.filesChanged = new EventEmitter<void>();
    this.parser = new FileParser();

    const pattern = new RelativePattern(
      ws.getWorkspaceFolder(workspace.uri)!,
      settings.getBaseGlob() +  settings.getWatchGlob())

    const watcher = ws.createFileSystemWatcher(pattern)
      
    watcher.onDidChange((event: Uri) => { 
      this.log.info(`${event} changed`)
      this.filesChanged.fire() 
    })
    watcher.onDidCreate((event: Uri) => { 
      this.log.info(`${event} created`)
      this.filesChanged.fire() 
    })
    watcher.onDidDelete((event: Uri) => { 
      this.log.info(`${event} deleted`)
      this.filesChanged.fire() 
    })
  }

  public async loadTestSuite () : Promise<TestSuiteInfo> {
    const files = await ws.findFiles(settings.getBaseGlob() + settings.getTestGlob())
  
    let testInfo: (TestSuiteInfo | TestInfo)[] = []

    for(const file of files) {
      testInfo = [...testInfo, ...this.parser.parse(file)]
    }

    return {
      id: "root",
      label: `root`,
      type: "suite",
      children: testInfo
    }   
  }  
}