// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { glassSurface } from '@/lib/surfaces';
import { cn } from '@/lib/utils';

const answerLink = 'font-medium text-blue-700 underline underline-offset-4 dark:text-blue-300';

const questions = [
  {
    question: 'Can I self-host Stackweaver for free?',
    answer: <>
      Yes. You can run Stackweaver on your own infrastructure for your team without a subscription, under the
      Business Source License 1.1. You provide and operate the infrastructure. Start with the{' '}
      <Link className={answerLink} to="/docs/get-started/self-hosting">self-hosting guide</Link>.
    </>,
  },
  {
    question: 'Can I install Stackweaver with Docker Compose or Helm?',
    answer: <>
      Yes. <Link className={answerLink} to="/docs/get-started/self-hosting/docker-compose">Docker Compose</Link>{' '}
      runs the stack on one machine. Use the{' '}
      <Link className={answerLink} to="/docs/get-started/self-hosting/kubernetes">Helm chart</Link>{' '}
      to install it in a Kubernetes cluster.
    </>,
  },
  {
    question: 'How does Stackweaver work with Ansible, OpenTofu and Terraform?',
    answer: <>
      Stackweaver runs <Link className={answerLink} to="/ansible">Ansible playbooks</Link>{' '}
      and executes plans and applies with OpenTofu. You can use the Terraform CLI for supported remote workflows
      through the Terraform Enterprise API. See the{' '}
      <Link className={answerLink} to="/compare/terraform-cloud">Terraform and OpenTofu compatibility details</Link>.
    </>,
  },
  {
    question: 'What can my team do under the source-available license?',
    answer: <>
      The license lets you inspect and modify the code and run Stackweaver in production for your own business.
      It restricts offering it to third parties as a commercial managed service. Read the{' '}
      <a className={answerLink} href="https://github.com/vhco-pro/stackweaver-api/blob/main/LICENSE">full license</a>{' '}
      for the terms.
    </>,
  },
  {
    question: 'Can VH & Co help us set up or maintain our instance?',
    answer: <>
      Yes. VH &amp; Co can help you deploy Stackweaver on your infrastructure or work with you on ongoing maintenance.
      {' '}<a className={answerLink} href="mailto:contact@vhco.pro">Get in touch</a> to discuss what your team needs.
    </>,
  },
];

export function FrequentlyAskedQuestions() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="relative scroll-mt-28 px-4 py-12 md:px-6 md:py-20">
      <div className="mx-auto max-w-3xl">
        <h2 id="faq-heading" className="mb-8 text-center text-3xl font-bold sm:text-4xl md:mb-12">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {questions.map(({ question, answer }) => (
            <details key={question} className={cn(glassSurface, 'group overflow-clip')}>
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold text-slate-950 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-blue-700 sm:px-6 dark:text-white dark:focus-visible:outline-blue-300 [&::-webkit-details-marker]:hidden">
                {question}
                <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-blue-700 group-open:rotate-180 dark:text-blue-300" />
              </summary>
              <p className="px-4 pb-4 text-base leading-relaxed text-slate-800 sm:px-6 dark:text-slate-300">
                {answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
