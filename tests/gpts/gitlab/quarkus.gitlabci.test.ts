import { skipSuite } from "../../test-utils.ts";
import { loadSoftwareTemplatesTestsGlobals } from "../github/test-config/config.ts";
import { gitLabProviderGitLabCIWithPromotionTests } from "./suites-config/gitlab_gitlabci_advanced.ts";

const quarkusTemplateName = 'java-quarkus';
const stringOnRoute =  'Congratulations, you have created a new Quarkus cloud application.';
const gitLabOrganization = process.env.GITLAB_ORGANIZATION_PUBLIC || '';

const runQuarkusBasicTests = () => {
    const configuration = loadSoftwareTemplatesTestsGlobals();

    if (configuration.templates.includes(quarkusTemplateName) && configuration.gitlab && configuration.gitlab.gitlabci) {
        gitLabProviderGitLabCIWithPromotionTests(quarkusTemplateName, stringOnRoute, gitLabOrganization);
    } else {
        skipSuite(quarkusTemplateName);
    }
};

runQuarkusBasicTests();
