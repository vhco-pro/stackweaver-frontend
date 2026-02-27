// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="py-16 px-6 border-t border-slate-200 dark:border-white/10 bg-gradient-to-t from-slate-100/50 to-transparent dark:from-slate-950/50 dark:to-transparent">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-4">About</h3>
            <p className="text-slate-800 dark:text-gray-400 text-sm">
              Stackweaver is a DevOps automation platform for managing infrastructure and configuration with Terraform, OpenTofu, and Ansible.
            </p>
          </div>
          
          {/* Links */}
          <div>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-4">Resources</h3>
            <ul className="space-y-2 text-sm text-slate-800 dark:text-gray-400">
              <li>
                <a href="https://github.com/michielvha/stackweaver" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  GitHub
                </a>
              </li>
              <li>
                <Link to="/docs" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <a href="#" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Support
                </a>
              </li>
            </ul>
          </div>
          
          {/* Legal */}
          <div>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-slate-800 dark:text-gray-400">
              <li>
                <Link to="/privacy" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a href="#" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
              <li className="text-slate-800 dark:text-gray-500">
                License information will be available soon.
              </li>
            </ul>
          </div>
        </div>
        
        {/* Divider */}
        <div className="border-t border-slate-200 dark:border-white/10 pt-8 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-800 dark:text-gray-400 text-sm">
              © {new Date().getFullYear()} Stackweaver. All rights reserved.
            </p>
            <p className="text-slate-800 dark:text-gray-500 text-xs">
              Made with ❤️ in Belgium by{' '}
              <a 
                href="https://vhco.pro" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-slate-800 dark:text-gray-400 hover:text-blue-600 dark:hover:text-white transition-colors underline decoration-slate-300 dark:decoration-white/30 hover:decoration-blue-600 dark:hover:decoration-white/60"
              >
                vhco.pro
              </a>
              {' '}and{' '}
              <a 
                href="https://truyens.pro" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-slate-800 dark:text-gray-400 hover:text-blue-600 dark:hover:text-white transition-colors underline decoration-slate-300 dark:decoration-white/30 hover:decoration-blue-600 dark:hover:decoration-white/60"
              >
                truyens.pro
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
