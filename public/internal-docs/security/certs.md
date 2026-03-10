<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Enterprise Certifications for Stackweaver: Reality Check & Strategy

## The Certification Landscape

### ISO/IEC 27001
**What it is:** International standard for information security management systems (ISMS)

**Cost breakdown:**
- Consultant/implementation: €10,000 - €30,000
- Certification body audit: €5,000 - €15,000
- Annual surveillance audits: €3,000 - €8,000
- **Total first year: €15,000 - €45,000**

**Timeline:** 6-12 months

**Reality check:** This is overkill for a solo contractor with an open-source product at launch.

### SOC 2 Type II
**What it is:** US-based audit framework focused on security controls (Security, Availability, Confidentiality, Processing Integrity, Privacy)

**Cost breakdown:**
- Readiness assessment: €5,000 - €15,000
- Implementation: €10,000 - €25,000
- Actual audit: €15,000 - €40,000
- **Total first year: €30,000 - €80,000**

**Timeline:** 9-12 months (includes mandatory 3-6 month observation period)

**Reality check:** Even MORE overkill. SOC 2 is for SaaS companies with hosted services.

### TISAX
**What it is:** Automotive industry security assessment (VDA ISA based)

**Cost:** €3,000 - €10,000

**Reality check:** Only relevant if targeting automotive manufacturers specifically.

## Why You're Asking the Wrong Question

Here's what enterprises *actually* care about when evaluating tooling like Stackweaver:

### For Open-Source Projects (Pre-Enterprise-Hosting):
1. **Code quality & security practices**
   - Do you have CI/CD with security scanning?
   - Are dependencies kept up to date?
   - Do you follow secure coding practices?

2. **Community & governance**
   - Is there a security disclosure process?
   - How are vulnerabilities handled?
   - Is there a roadmap and active development?

3. **Documentation**
   - Architecture diagrams
   - Security model documentation
   - Deployment best practices

4. **Your credibility**
   - Your Kubernetes certifications (KCNA, KCSA, CKA)
   - Professional experience
   - Case studies/references

### For Commercial Support/Hosting (Future):
This is when certifications start mattering - but only if you're hosting infrastructure for customers.

## What You Actually Need for Q1 2026 Launch

### Phase 0: Pre-Launch (Now - Q1 2026)

**Free/Low-Cost Must-Haves:**

1. **Security Policy Documentation** (1-2 weeks work)
   - Vulnerability disclosure policy
   - Security response process
   - Supported versions & EOL policy
   - Create `SECURITY.md` in your repo

2. **OpenSSF Best Practices Badge** (Free)
   - https://bestpractices.coreinfrastructure.org/
   - Demonstrates your project follows security best practices
   - Takes 2-4 weeks to achieve
   - EU enterprises recognize this

3. **SBOM (Software Bill of Materials)** (Free)
   - Generate with Syft or similar
   - Include in releases
   - EU's Cyber Resilience Act will make this mandatory anyway

4. **Basic Compliance Documentation** (1 week)
   - GDPR compliance statement (if handling any data)
   - Data processing agreement template
   - Privacy policy

5. **Container Image Signing** (Free)
   - Use Sigstore/Cosign
   - Sign your container images
   - Enterprises love this

**Cost: €0 - €500 (your time + maybe a lawyer review for GDPR docs)**

### Phase 1: First Enterprise Customers (Q2-Q3 2026)

**When You Have Revenue:**

1. **Security Questionnaire Template** (€500-1,500)
   - Hire consultant to help you complete a comprehensive one
   - Reuse for all future customers
   - Most enterprises send their own anyway

2. **Penetration Testing** (€2,000 - €5,000)
   - External security audit of Stackweaver
   - Generates a report you can show customers
   - More valuable than certifications at this stage

3. **Cyber Insurance** (€1,000 - €3,000/year)
   - Professional liability + cyber coverage
   - Some enterprises require this
   - Often requires basic security practices

4. **Legal Contract Templates** (€1,500 - €3,000)
   - MSA (Master Service Agreement)
   - SLA (Service Level Agreement)
   - DPA (Data Processing Agreement) - GDPR compliant

**Cost: €5,000 - €12,500**

### Phase 2: Scaling (Late 2026+)

**When You Have 5+ Enterprise Customers:**

Now you can justify:
- SOC 2 Type II (if offering hosted/managed services)
- ISO 27001 (if customers keep asking for it)
- Hiring a compliance person/fractional CISO

## The Real Enterprise Sales Blocker

It's usually NOT certifications. It's:

1. **"Is this some dude in Belgium or a real company?"**
   - Solution: Professional website, case studies, clear company info
   - Your BV (VH & Co) helps here

2. **"What happens if he gets hit by a bus?"**
   - Solution: Clear succession plan, escrow agreements, open-source means code survives
   - Offer commercial support SLAs

3. **"How do we know it's secure?"**
   - Solution: Security documentation, pen test report, SBOM, signed releases
   - NOT necessarily certifications

4. **"Will they still exist in 2 years?"**
   - Solution: Runway transparency, existing customer logos, active development

## Recommended Strategy for Stackweaver

### Short-term (Q1-Q2 2026):
```markdown
☐ Create SECURITY.md with vulnerability disclosure process
☐ Apply for OpenSSF Best Practices Badge
☐ Generate and publish SBOM with releases
☐ Implement container image signing (Cosign)
☐ Create security architecture documentation
☐ Write basic GDPR compliance docs (get lawyer review)
☐ Set up automated security scanning in CI/CD (Snyk, Trivy, etc.)
```

**Investment: Your time + ~€500**

### Medium-term (Q3-Q4 2026):
```markdown
☐ Complete first penetration test
☐ Get cyber insurance
☐ Create reusable security questionnaire responses
☐ Develop case studies from early customers
☐ Consider Kubernetes security certification (CKS)
```

**Investment: €5,000 - €10,000**

### Long-term (2027):
```markdown
☐ Evaluate SOC 2 Type II if offering managed services
☐ Consider ISO 27001 if multiple customers require it
☐ Hire fractional CISO/compliance consultant
```

**Investment: €20,000 - €60,000**

## EU-Specific Considerations

### Cyber Resilience Act (CRA)
Coming into force 2024-2027, this will affect products with "digital elements" including:
- Mandatory security updates
- Vulnerability handling requirements
- CE marking for some products

**Your action:** Monitor this, but as open-source with commercial support model, you may have lighter requirements.

### NIS2 Directive
Affects "essential entities" and their suppliers. If your customers are in critical sectors (energy, transport, health), they may impose requirements on you.

**Your action:** Have a basic incident response plan ready.

### GDPR
You already know this one. Key for Stackweaver:
- If you're just providing software (on-prem deployment): minimal impact
- If you're providing hosted services: you're a data processor, need DPA

## The Belgian Angle

**Advantages:**
- EU-based gives you credibility with EU enterprises
- GDPR compliance is "native" (not trying to retrofit US company)
- Strong DevOps/cloud community in Belgium/BeNeLux

**Leverage this:**
- "EU-based, GDPR-native infrastructure tooling"
- Target BeNeLux enterprises first (easier sales, same language/culture)
- Belgium has strong presence in logistics, pharma, finance - all need GitOps

## What Enterprises Actually Ask For

Based on real B2B SaaS sales cycles, here's the typical progression:

**First call:**
- "Tell me about your security practices"
- "Do you have SOC 2?" (they ask everyone this)
- "What's your uptime SLA?"

**Your answer:**
- Walk through your security documentation
- Explain open-source model + commercial support
- Show penetration test results when you have them
- "We're pursuing SOC 2 for 2027 based on customer demand" (if doing hosted)

**Due diligence phase:**
- They send 50-200 question security questionnaire
- Ask for architecture diagrams
- Want to know about your backup/DR processes
- May ask about insurance

**Procurement:**
- Legal reviews your MSA
- They want DPA for GDPR
- May require cyber insurance
- Rarely require ISO 27001 unless very large/regulated

## Bottom Line

**Don't spend €15K+ on certifications before you have customers willing to pay for them.**

Instead:
1. Build solid security practices into Stackweaver (free)
2. Document everything clearly (1-2 weeks)
3. Get OpenSSF badge (free + time)
4. Launch and get first customers
5. Use early revenue for pen testing + insurance
6. Let customer demand drive certification decisions

**The best "certification" is happy enterprise customers willing to be references.**

## Resources

### Free/Low-Cost Security
- OpenSSF Best Practices: https://bestpractices.coreinfrastructure.org/
- OWASP resources: https://owasp.org/
- Sigstore (image signing): https://www.sigstore.dev/
- Trivy (security scanning): https://trivy.dev/

### Compliance Templates
- GDPR DPA templates: https://gdpr.eu/data-processing-agreement/
- Common security questionnaires: Google "Consensus SIG Lite" or "CAIQ"

### Belgian Resources
- Fedict (Belgian digital transformation): https://www.fedict.belgium.be/
- Agoria (Belgian tech federation): https://www.agoria.be/

### When You're Ready for Certifications
- ISO 27001 consultants: Search "ISO 27001 consultancy Belgium"
- SOC 2 auditors: Big 4 (Deloitte, PwC, EY, KPMG) or Vanta, Drata (automated)

## Questions to Ask Yourself

Before pursuing ANY certification:

1. Have at least 3 enterprise prospects explicitly asked for it?
2. Have you lost a deal specifically because you lacked it?
3. Do you have revenue to justify the €15K-50K investment?
4. Are you ready for the ongoing maintenance burden?

If the answer to all 4 isn't "yes," focus on the free/low-cost options first.

---

**Final advice:** Your Kubernetes certifications (KCNA, KCSA, CKA) + working toward Kubestronaut are MORE valuable for Stackweaver credibility than ISO 27001 at this stage. Enterprises buying GitOps tooling care that you're a Kubernetes expert first, compliant vendor second.