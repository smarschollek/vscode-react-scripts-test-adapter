# React-scripts Test Adapter

Simple test adapter for react-scripts testing in CRA projects

### Getting started

* Install the extension and restart VS Code
* Open a CRA project with tests
   * At the moment the extensions searches for `./node_modules/.bin/react-scripts` inside the workspace 
   folder to initialize itself
*  Open the Test Explorer and run/debug your tests

### Open Issues

* Filewatcher to recognize filechanges inside the workspacefolder
* Debugging a Suite is not possible atm only sinlge testcases
* Validate the result when debugging a test ( atm it is just the skipped event )
* Recognize describe functions inside testfiles and build some hierarchie