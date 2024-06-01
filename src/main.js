import core from '@actions/core';
import github from '@actions/github';
import { getfailedJob, getSummary } from './github.js';
import { setupAndSendEmail } from './email.js';
import { Octokit } from '@octokit/rest';

/**
 * The main function for the action.
 * This will be uses to find which workflow is get failed and it will send notification to slack channel and also send email to the user.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const isWorkflowRun = github.context.eventName === 'workflow_run';
    const run_id = isWorkflowRun
      ? github.context.payload.workflow_run.id
      : github.context.runId;

    core.debug(`The run id is: ${run_id}`);
    core.debug(`The event name is: ${github.context.eventName}`);

    // Get the inputs from the workflow file
    const slack_webhook = core.getInput('slack_webhook');
    const sender_email = core.getInput('sender_email');
    const sender_email_password = core.getInput('sender_email_password');
    const team_email_addresses = core.getInput('team_email_addresses');
    const github_token = core.getInput('github_token');
    core.setSecret(github_token);
    // core.setSecret(slack_webhook);
    core.debug('repo' + github.context.repo.repo);
    core.debug('owner' + github.context.repo.owner);
    // Create a new octokit instance
    const octokit = new Octokit({
      auth: github_token
    });
    const failedJob = await getfailedJob(octokit, run_id);
    // const workflowRun = await getWorkflowRun(octokit, run_id);

    if (failedJob.length === 0) {
      core.info('No failed jobs found');
      return;
    }

    // if (isWorkflowRun) {
    //   await getJobLogZip(octokit, run_id);
    // }

    const summary = await getSummary(octokit, isWorkflowRun, failedJob);
    core.debug('summary: ' + JSON.stringify(summary));
    // Send the email to the user
    const response = await setupAndSendEmail(
      sender_email,
      sender_email_password,
      team_email_addresses,
      `${github.context.repo.repo} workflow detected failed actions`,
      JSON.stringify(summary)
    );

    // Send the email to the team
    // if (!response) {
    //   core.setFailed('Failed to send email to the team');
    // }
    core.info('Email sent successfully', response);

    // Send the notification to the slack channel
  } catch (error) {
    core.setFailed(error.message);
  }
}

export { run };
