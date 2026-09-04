---
title: How I think about Terraform providers
date: 2026-09-05
summary: Notes on building Go Terraform providers, acceptance tests, and keeping schema aligned with REST APIs.
published: false
---

This is a draft. Set `published: true` in the frontmatter when you want it on the site.

## Why providers

A Terraform provider is an API client with a contract. The interesting work is mapping resources to Create / Read / Update / Destroy and proving that loop with acceptance tests.

When you are ready, replace this file or add another Markdown file in `content/blog/`.
