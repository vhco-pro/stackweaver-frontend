// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, FileText, Download, Trash2, Eye, Lock } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-300 via-cyan-300 to-sky-300 bg-clip-text text-transparent">
                Privacy Policy
              </h1>
              <p className="text-gray-400 mt-2">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {/* Introduction */}
          <section className="prose prose-invert max-w-none">
            <p className="text-lg text-gray-300 leading-relaxed">
              At Stackweaver, we are committed to protecting your privacy and ensuring transparency 
              about how we collect, use, and safeguard your personal information. This Privacy Policy 
              explains our practices in compliance with the General Data Protection Regulation (GDPR) 
              and other applicable data protection laws.
            </p>
          </section>

          {/* Data Collection */}
          <section className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
              <FileText className="h-6 w-6 text-blue-400" />
              Information We Collect
            </h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="font-semibold text-white mb-2">Personal Information</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Name and email address (from Zitadel authentication)</li>
                  <li>Profile information (username, bio, company, location)</li>
                  <li>Organization and workspace memberships</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Usage Data</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>API usage and activity logs</li>
                  <li>Workspace and run history</li>
                  <li>Audit logs of actions performed</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Technical Data</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>IP addresses and user agents</li>
                  <li>Session information</li>
                  <li>Device and browser information</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Data */}
          <section className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-8">
            <h2 className="text-2xl font-bold mb-4">How We Use Your Information</h2>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-blue-400 mt-1">•</span>
                <span>To provide and maintain our service</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 mt-1">•</span>
                <span>To authenticate and authorize access to resources</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 mt-1">•</span>
                <span>To manage organizations, projects, and workspaces</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 mt-1">•</span>
                <span>To execute and monitor OpenTofu runs</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 mt-1">•</span>
                <span>To maintain audit logs for security and compliance</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 mt-1">•</span>
                <span>To improve our services and user experience</span>
              </li>
            </ul>
          </section>

          {/* Your Rights */}
          <section className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Lock className="h-6 w-6 text-blue-400" />
              Your Rights Under GDPR
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <Eye className="h-5 w-5 text-blue-400" />
                  <h3 className="font-semibold text-white">Right to Access</h3>
                </div>
                <p className="text-sm text-gray-400">
                  You can request a copy of all personal data we hold about you.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <Download className="h-5 w-5 text-blue-400" />
                  <h3 className="font-semibold text-white">Right to Data Portability</h3>
                </div>
                <p className="text-sm text-gray-400">
                  Export your data in a machine-readable format.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="h-5 w-5 text-blue-400" />
                  <h3 className="font-semibold text-white">Right to Rectification</h3>
                </div>
                <p className="text-sm text-gray-400">
                  Update or correct your personal information at any time.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <Trash2 className="h-5 w-5 text-blue-400" />
                  <h3 className="font-semibold text-white">Right to Erasure</h3>
                </div>
                <p className="text-sm text-gray-400">
                  Request deletion of your account and personal data.
                </p>
              </div>
            </div>
          </section>

          {/* Data Security */}
          <section className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-8">
            <h2 className="text-2xl font-bold mb-4">Data Security</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-blue-400 mt-1">•</span>
                <span>AES-256 encryption for sensitive variables</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 mt-1">•</span>
                <span>Secure authentication via Zitadel (OAuth2/OIDC)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 mt-1">•</span>
                <span>Encrypted database connections</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 mt-1">•</span>
                <span>Regular security audits and updates</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 mt-1">•</span>
                <span>Access controls and RBAC</span>
              </li>
            </ul>
          </section>

          {/* Cookies */}
          <section className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-8">
            <h2 className="text-2xl font-bold mb-4">Cookies</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We use cookies to enhance your experience. You can manage your cookie preferences at any time.
            </p>
            <div className="space-y-3 text-gray-300">
              <div>
                <h3 className="font-semibold text-white mb-1">Necessary Cookies</h3>
                <p className="text-sm">Required for the website to function. These cannot be disabled.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Analytics Cookies</h3>
                <p className="text-sm">Help us understand how visitors use our website.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Marketing Cookies</h3>
                <p className="text-sm">Used to deliver personalized content and track campaign effectiveness.</p>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-md border border-blue-500/20 p-8">
            <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
            <p className="text-gray-300 mb-4">
              For privacy-related inquiries or to exercise your rights, please contact us:
            </p>
            <div className="space-y-2 text-gray-300">
              <p><strong className="text-white">Email:</strong> privacy@stackweaver.io</p>
              <p><strong className="text-white">Data Protection Officer:</strong> dpo@stackweaver.io</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

