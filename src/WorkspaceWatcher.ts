import {WorkspaceFolder, EventEmitter, Uri, workspace as vscodeWorkspace, Event} from 'vscode';
import * as chokidar from 'chokidar';
import anymatch from 'anymatch';
import {extname, join} from 'path';
import * as settings from "./settings";

export class WorkspaceWatcher {

  private _testMatcher = ['**/*' + settings.getTestGlob()]
  private _testFiles : Uri[];

  private _testFilesChangedEmitter: EventEmitter<void>
  private _testsRetiredEmitter: EventEmitter<Uri>

  constructor(public workspace: WorkspaceFolder) {
    this._testFilesChangedEmitter = new EventEmitter<void>();
    this._testsRetiredEmitter = new EventEmitter<Uri>();

    this._testFiles = []

    const watcher = chokidar.watch(join(workspace.uri.fsPath, settings.getBaseGlob() + settings.getWatchGlob()), {
      ignoreInitial: true
    });

    watcher
      .on('add', path => this.triggerEvent('add', Uri.file(path)))
      .on('change', path => this.triggerEvent('change', Uri.file(path)))
      .on('unlink', path => this.triggerEvent('delete', Uri.file(path)));
  }  

  get onTestFilesChanged(): Event<void> { return this._testFilesChangedEmitter.event; }
  get onTestsRetired(): Event<Uri> { return this._testsRetiredEmitter.event; }
  
  public async scanWorkspace() {
    this._testFiles = [];
    

    const files = await vscodeWorkspace.findFiles(settings.getBaseGlob() + settings.getTestGlob());
    for(const file of files) {
      const workspaceFolder = vscodeWorkspace.getWorkspaceFolder(file);
      if(workspaceFolder) {
        this._testFiles.push(file)
      }  
    }
  }

  public getTestFiles() : Uri[] {
    return this._testFiles.sort((a,b) => a.path < b.path ? 1 : -1)
  }

  private triggerEvent(action: 'add' | 'change' | 'delete', uri: Uri) {
      if(anymatch(this._testMatcher, uri.fsPath)) {
        this._testFilesChangedEmitter.fire();
      }
      else {
        const match = this.tryFindMatchingTestFile(uri)
        if(match)
        {
          this._testsRetiredEmitter.fire(match);
        }      
      }
  }
  
  private tryFindMatchingTestFile(uri: Uri) : Uri | undefined {
    const path = uri.path;
    const extension = extname(path);
    const matcher = path.replace(extension, settings.getTestGlob())
    
    for(const file of this._testFiles) {
      const hit = anymatch(matcher, file.path);
      if(hit) {
        return file;
      }
    }

    return undefined;
  }
}