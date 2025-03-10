import axios from 'axios';
import { Utils } from "./utils";
import * as qs from "qs";
import { generateRandomChars } from '../../../src/utils/generator';


export class BitbucketProvider extends Utils {
    private readonly bitbucket;

    constructor(bitbucketUsername: string, bitbucketAppPassword: string) {
        super();
        this.bitbucket = axios.create({
            baseURL: "https://api.bitbucket.org/2.0",
            auth: {
                username: bitbucketUsername || '',
                password: bitbucketAppPassword || '',
            },
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * checkifRepositoryExists checks if a repository exists in Bitbucket
     * @param workspace valid workspace in Bitbucket
     * @param repoSlug valid bitbucket repository
     */
    public async checkIfRepositoryExists(workspace: string, repoSlug: string): Promise<boolean> {
        try {
            const projects = await this.bitbucket.get(`/repositories/${workspace}/${repoSlug}`);
            console.info(`Repository '${repoSlug}' found in Workspace '${workspace}'
                created at '${projects.data.created_on}' and Status '${projects.status}' `);
            return projects.status === 200;
        } catch (error) {
            console.error('Error fetching repositories:', error);
            return false;
        }
    }

    /**
     * checkIfFolderExistsInRepository checks if a folder exists in Bitbucket repository
     * @param workspace valid workspace in Bitbucket
     * @param repoSlug valid bitbucket repository
     * @param folderPath folder path to check in repository
     */
    public async checkIfFolderExistsInRepository(workspace: string, repoSlug: string, folderPath: string): Promise<boolean> {
        try {
            const response = await this.bitbucket.get(`/repositories/${workspace}/${repoSlug}/src/main/${folderPath}`);
            return response.status === 200;
        } catch (error) {
            console.error(`Failed to fetch folderPath:`, error);
            return false;
        }
    }

    /**
     * delete repository in bitbucket
     * @param workspace valid workspace in Bitbucket
     * @param repoSlug valid bitbucket repository
     */
    public async deleteRepository(workspace: string, repoSlug: string): Promise<boolean> {
        try {
            const projects = await this.bitbucket.delete(`/repositories/${workspace}/${repoSlug}`);
            console.info(`Delete repository '${repoSlug}' from Workspace '${workspace}' `);
            return projects.status === 204;
        } catch (error) {
            console.error('Error deleting repository:', error);
            return false;
        }
    }

    /**
     * create commit in bitbucket repository
     * @param workspace valid workspace in Bitbucket
     * @param repoSlug valid bitbucket repository
     * @param repoBranch valid branch in bitbucket repository
     * @param fileName file name in bitbucket repo to add/update
     * @param fileContent file content to be committed in file
     */
    public async createCommit(
        workspace: string,
        repoSlug: string,
        repoBranch: string,
        fileName: string,
        fileContent: string,
    ):Promise<boolean> {
        try {

            const commitData = qs.stringify({
                [fileName]: fileContent,
                message: "Automatic commit generated from tests",
                branch: repoBranch,
            });

            const response = await this.bitbucket.post(
                `/repositories/${workspace}/${repoSlug}/src`,
                commitData,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                }
            );

            console.log(`Changes in file ${fileName} successfully committed for branch ${repoBranch}`);
            return response.status === 201;

        } catch (error) {
            console.error('Error committing file:', error);
            return false;
        }
    }

    /**
     * create WebHook in bitbucket repository
     * @param workspace valid workspace in Bitbucket
     * @param repoSlug valid bitbucket repository
     * @param webHookUrl valid webhook url to add in repository
     */
    public async createRepoWebHook(workspace: string, repoSlug: string, webHookUrl: string):Promise<string | undefined> {
        try{
            const webhookData = {
                "description": "rhtap-push",
                "url": webHookUrl,
                "active": true,
                "skip_cert_verification": true,
                "secret_set": false,
                "events": [
                    "repo:push",
                    "pullrequest:created",
                    "pullrequest:fulfilled"
                ]
            };
            const hook = await this.bitbucket.post(`/repositories/${workspace}/${repoSlug}/hooks`, webhookData);
            return hook.data;
        } catch (error) {
            console.error('Error creating webhook:', error);
        }
    }

    /**
     * creates pullrequest in bitbucket repository
     * @param workspace valid workspace in Bitbucket
     * @param repoSlug valid bitbucket repository where PR to open
     * @param fileName file name in bitbucket repo to add/update in PR
     * @param fileContent file content to be committed in file
     */
    public async createPullrequest(workspace: string, repoSlug: string, fileName: string, fileContent: string):Promise<number> {
        const testBranch = `test-${generateRandomChars(4)}`;

        // create new branch
        try{
            await this.bitbucket.post(
                `/repositories/${workspace}/${repoSlug}/refs/branches`,
                {
                    "name" : testBranch,
                    "target" : {
                        "hash" : "main",
                    }
                },
            );

            // Make changes in new branch
            await this.createCommit(workspace, repoSlug, testBranch, fileName, fileContent);

            // Open PR to merge new branch into main branch
            const prData = {
                "title": "PR created by Automated Tests",
                "source": {
                    "branch": {
                        "name": testBranch
                    }
                },
                "destination": {
                    "branch": {
                        "name": "main"
                    }
                }
            };

            const prResponse = await this.bitbucket.post(
                `repositories/${workspace}/${repoSlug}/pullrequests`,
                prData,
            );

            console.log(`Pull request ${prResponse.data.id} created in ${repoSlug} repository`);
            return prResponse.data.id;

        } catch(error){
            console.log(error);
            throw new Error("Failed to create merge request. Check below error");
        }
    }

    /**
     * merge pullrequest in bitbucket repository
     * @param workspace valid workspace in Bitbucket
     * @param repoSlug valid bitbucket repository where PR is open
     * @param pullRequestID valid ID of pull request to merge
     */
    public async mergePullrequest(workspace: string, repoSlug: string, pullRequestID: number) {
        const mergeData = {
            "type": "commit",
            "message": "PR merge by automated tests",
            "close_source_branch": true,
            "merge_strategy": "merge_commit"
        };

        try {
            await this.bitbucket.post(
                `repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestID}/merge`,
                mergeData
            );

            console.log(`Pull request "${pullRequestID}" merged successfully in ${repoSlug} repository`);
        } catch (error) {
            console.log("Error merging PR", error);
        }
    }

    public async createPromotionPullrequest(workspace: string, componentName: string, fromEnvironment: string, toEnvironment: string):Promise<number> {
        const pattern = /- image: (.*)/;
        let extractedImage;

        try {
            const fromEnvironmentContent = await this.bitbucket.get(`/repositories/${workspace}/${componentName}-gitops/src/main/components/${componentName}/overlays/${fromEnvironment}/deployment-patch.yaml`);
            const matchImage = fromEnvironmentContent.data.match(pattern);
            if (matchImage && matchImage.length > 1) {
                extractedImage = matchImage[1];
                console.log("Extracted image:", extractedImage);
            } else {
                throw new Error("Image not found in the gitops repository path");
            }

            const toEnvironmentContent = await this.bitbucket.get(`/repositories/${workspace}/${componentName}-gitops/src/main/components/${componentName}/overlays/${toEnvironment}/deployment-patch.yaml`);
            const newContent = toEnvironmentContent.data.replace(pattern, `- image: ${extractedImage}`);
            return await this.createPullrequest(workspace, `${componentName}-gitops`, `components/${componentName}/overlays/${toEnvironment}/deployment-patch.yaml`, newContent);
        } catch(error){
            console.log(error);
            throw new Error("Failed to create merge request. Check below error");
        }

    }

}
