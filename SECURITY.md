# Security Policy

## Reporting a Vulnerability

If you believe you have found a security vulnerability in this Figma plugin or in the **self-hosted Cloudflare Worker** used as an HTTPS proxy for TinyPNG API calls, please report it responsibly.

**How to report**

- Email: **cxqtouch@gmail.com** (replace with your real contact before publishing)
- Include: short description, steps to reproduce, affected component (plugin UI / main thread / Worker), and severity if known.
- Do not open a public issue for undisclosed vulnerabilities.

**What we do**

- We aim to acknowledge reports within **5 business days**.
- We triage severity and work on fixes; for the Worker, updates are deployed via Cloudflare Workers.
- We will follow up when the issue is resolved or if we need more information.

**Scope notes**

- The plugin stores the TinyPNG API key locally in Figma `clientStorage` on the user’s machine.
- The Worker is used to forward HTTPS requests to TinyPNG; it is not intended to retain user payloads beyond transient edge processing.

---

## 安全漏洞报告（中文摘要）

若你发现本插件或自建 **Cloudflare Worker（TinyPNG 请求代理）** 存在安全问题，请通过上方邮箱**私下**报告，勿在公开 Issue 中披露未修复漏洞。我们会在合理时间内确认并跟进修复。

