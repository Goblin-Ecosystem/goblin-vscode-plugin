import * as vscode from 'vscode';
import * as xml2js from 'xml2js';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.commands.registerCommand('goblin.check', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active text editor found.');
            return;
        }

        if (!editor.document.fileName.endsWith('pom.xml')) {
            vscode.window.showErrorMessage('Active file is not a pom.xml file.');
            return;
        }

        const text = editor.document.getText();
        const parser = new xml2js.Parser();

        parser.parseStringPromise(text).then(result => {
            const diagnostics: vscode.Diagnostic[] = [];

            if (result && result.project && result.project.dependencies && result.project.dependencies[0].dependency) {
                const dependencies = result.project.dependencies[0].dependency;

                dependencies.forEach((dep: any) => {
                    const groupId = dep.groupId ? dep.groupId[0] : '';
                    const artifactId = dep.artifactId ? dep.artifactId[0] : '';

                    if (!checkDependency(groupId, artifactId)) {
                        const startPos = editor.document.positionAt(text.indexOf(artifactId));
                        const endPos = startPos.translate(0, artifactId.length);
                        const range = new vscode.Range(startPos, endPos);

                        const diagnostic = new vscode.Diagnostic(
                            range,
                            `Invalid dependency: ${groupId}:${artifactId}`,
                            vscode.DiagnosticSeverity.Error
                        );

                        diagnostics.push(diagnostic);
                    }
                });
            }

            const collection = vscode.languages.createDiagnosticCollection('pom');
            collection.set(editor.document.uri, diagnostics);
        }).catch(err=> {
            vscode.window.showErrorMessage('Failed to parse pom.xml file.');
            console.error(err);
        });
    });

	context.subscriptions.push(disposable);

	let disposable2 = vscode.commands.registerCommand('goblin.report', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const filePath = editor.document.uri.fsPath;
			const projectDir = path.dirname(filePath);
			// const command = `mvn clean com.cifre.sap.su:goblin-maven-plugin:goblin`;
			const command = `mvn clean site`;
			cp.exec(command, { cwd: projectDir }, (error, stdout, stderr) => {
				if (error) {
					vscode.window.showErrorMessage(`Fail to generate report: ${error}`);
					return;
				}
				if (stderr) {
					vscode.window.showErrorMessage(`Fail to generate report: ${stderr}`);
					return;
				}
				const sitePath = path.join(projectDir, 'target', 'site', 'goblin-report.html');
				fs.readFile(sitePath, 'utf8', (err, data) => {
					if (err) {
						vscode.window.showErrorMessage(`Failed to read site report: ${err.message}`);
						return;
					}
					const panel = vscode.window.createWebviewPanel('goblin', 'Goblin Report', vscode.ViewColumn.One, {
						enableScripts: true,
						localResourceRoots: [
							vscode.Uri.file(path.join(projectDir, 'target', 'site')),
							vscode.Uri.file(path.join(projectDir, 'target', 'site', 'css')),
							vscode.Uri.file(path.join(projectDir, 'target', 'site', 'images')),
							vscode.Uri.file(path.join(projectDir, 'target', 'site', 'images', 'logos'))
						]
					});
					const baseUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(projectDir, 'target', 'site')));
					const modifiedHtml = data.replace(/(href|src)="([^"]+)"/g, (match, p1, p2) => {
						const resourceUri = vscode.Uri.file(path.join(projectDir, 'target', 'site', p2)).with({ scheme: 'vscode-resource' });
						return `${p1}="${panel.webview.asWebviewUri(resourceUri)}"`;
					});					
					panel.webview.html = modifiedHtml;
				});
			});
		} else {
			vscode.window.showErrorMessage('No active text editor.');
		}
	});

	context.subscriptions.push(disposable2);
}

// This method is called when your extension is deactivated
export function deactivate() { }

function checkDependency(groupId: string, artifactId: string): boolean {
    return false;
}