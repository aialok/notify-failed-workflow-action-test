import core from '@actions/core';
import github from '@actions/github';
import fs from 'fs';
import path from 'path';
import admZip from 'adm-zip';

export const getfailedJob = async (octokit, run_id) => {
  const jobs = await octokit.actions.listJobsForWorkflowRun({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    run_id
  });

  core.debug('fetched jobs for workflow run');

  const completed_jobs = jobs.data.jobs.filter(
    job => job.status === 'completed'
  );
  const failed_job = completed_jobs.find(job => job.conclusion === 'failure');
  return failed_job || [];
};

export const getWorkflowRun = async (octokit, run_id) => {
  const workflowRun = await octokit.actions.getWorkflowRun({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    run_id
  });

  core.debug('fetched workflow run');

  return workflowRun.data;
};

export async function getJobAnnotations(octokit, jobId) {
  const { data } = await octokit.rest.checks.listAnnotations({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    check_run_id: jobId
  });
  core.debug('fetched annotations');

  const excludeDefaultErrorAnnotations = data.filter(
    a => !isDefaultErrorMessage(a)
  );
  core.debug(
    `exclude default error annotations: ${excludeDefaultErrorAnnotations.length}`
  );

  return excludeDefaultErrorAnnotations;
}

export async function getSummary(octokit, isWorkflowRun, jobs) {
  core.debug(`jobs: ${jobs.length}`);

  const summary = jobs.reduce(async (acc, job) => {
    const annotations = await getJobAnnotations(octokit, job.id);

    if (isWorkflowRun) {
      if (annotations.length > 0) {
        core.debug(`jobId: ${job.id}, annotations: ${annotations.length}`);
        return [...(await acc), { ...job, annotations }];
      }
      const jobLog = await getJobLog(job);
      core.debug(`jobId: ${job.id}, log: ${jobLog.length}`);
      return [...(await acc), { ...job, jobLog }];
    }

    if (annotations.length > 0) {
      core.debug(`jobId: ${job.id}, annotations: ${annotations.length}`);
      return [...(await acc), { ...job, annotations }];
    }

    return [...(await acc), { ...job }];
  });

  return summary;
}

export async function getJobLogZip(octokit, runId) {
  const res = await octokit.request(
    `GET /repos/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${runId}/logs`
  );
  core.debug('fetched run logs');

  const extractedDir = path.join(process.cwd(), LOG_DIR);
  const zipFilePath = path.join(process.cwd(), LOG_ZIP_FILE);

  fs.writeFileSync(zipFilePath, Buffer.from(res.data));
  const zip = new admZip(zipFilePath);
  zip.extractAllTo(extractedDir, true);
}

// NOTE: remove like '2023-12-05T07:08:20.6282273Z ` string each lines
// NOTE: laltest 30 lines
export function formatLog(log) {
  return log
    .split('\n')
    .map(l => l.split(' ').slice(1).join(' '))
    .slice(-LATEST_LINES)
    .join('\n');
}

export async function getJobLog(job) {
  const failedSteps = job.steps?.filter(s => s.conclusion === 'failure');
  const logs = failedSteps?.map(s => {
    const sanitizedJobName = job.name.replaceAll('/', '');

    const baseDir = path.join(process.cwd(), LOG_DIR);
    const normalizedPath = path.normalize(
      path.join(
        process.cwd(),
        LOG_DIR,
        sanitizedJobName,
        `${s.number}_${s.name}.txt`
      )
    );

    if (!normalizedPath.startsWith(baseDir)) {
      throw new Error('Invalid path');
    }

    const logFile = fs.readFileSync(normalizedPath);

    return {
      log: formatLog(logFile.toString()),
      stepName: s.name
    };
  });
  core.debug('get log from logfile');

  return logs || [];
}

export function isDefaultErrorMessage(annotation) {
  return (
    (annotation.path === '.github' &&
      annotation.message?.startsWith('Process completed with exit code')) ||
    false
  );
}
