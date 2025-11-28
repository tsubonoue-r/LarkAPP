#!/usr/bin/env node
/**
 * Generate Dashboard Data Script
 * Fetches GitHub Issues and PRs to generate dashboard data
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

if (!GITHUB_REPOSITORY) {
  console.error('❌ GITHUB_REPOSITORY environment variable is required');
  process.exit(1);
}

interface Issue {
  number: number;
  title: string;
  state: string;
  labels: string[];
  created_at: string;
  updated_at: string;
}

interface DashboardData {
  generatedAt: string;
  repository: string;
  summary: {
    totalIssues: number;
    openIssues: number;
    closedIssues: number;
    stateBreakdown: Record<string, number>;
  };
  issues: Issue[];
}

async function fetchIssues(): Promise<any[]> {
  const [owner, repo] = GITHUB_REPOSITORY!.split('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100`;

  console.log(`📡 Fetching issues from ${GITHUB_REPOSITORY}...`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch issues: ${response.statusText}`);
  }

  const issues = await response.json();
  console.log(`✓ Fetched ${issues.length} issues`);
  return issues;
}

function analyzeIssues(issues: any[]): DashboardData {
  const stateBreakdown: Record<string, number> = {};

  const processedIssues: Issue[] = issues
    .filter((issue) => !issue.pull_request) // Filter out PRs
    .map((issue) => {
      const labels = issue.labels.map((label: any) => label.name);

      // Count state labels
      labels.forEach((label: string) => {
        if (label.startsWith('state:')) {
          stateBreakdown[label] = (stateBreakdown[label] || 0) + 1;
        }
      });

      return {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
      };
    });

  const openIssues = processedIssues.filter((issue) => issue.state === 'open').length;
  const closedIssues = processedIssues.filter((issue) => issue.state === 'closed').length;

  return {
    generatedAt: new Date().toISOString(),
    repository: GITHUB_REPOSITORY!,
    summary: {
      totalIssues: processedIssues.length,
      openIssues,
      closedIssues,
      stateBreakdown,
    },
    issues: processedIssues,
  };
}

async function main() {
  try {
    console.log('🚀 Starting dashboard data generation...');

    const issues = await fetchIssues();
    const dashboardData = analyzeIssues(issues);

    const outputPath = join(process.cwd(), 'docs', 'dashboard-data.json');
    writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2));

    console.log(`✅ Dashboard data written to: ${outputPath}`);
    console.log(`📊 Summary:`);
    console.log(`   Total Issues: ${dashboardData.summary.totalIssues}`);
    console.log(`   Open: ${dashboardData.summary.openIssues}`);
    console.log(`   Closed: ${dashboardData.summary.closedIssues}`);
    console.log(`   State Breakdown:`, dashboardData.summary.stateBreakdown);
  } catch (error) {
    console.error('❌ Error generating dashboard data:', error);
    process.exit(1);
  }
}

main();
