# Requirements Document

## Introduction

The product is called "Skeleton Kit", with a capital K. Six places write "Skeleton kit" with a small k: the page title, the logo label and the logo text of `site/index.html`, the description in `power/skeleton-kit/plugin.json`, the heading of `power/skeleton-kit/README.md` and the description of the skill `play-and-prove`. This spec fixes them and adds a test that keeps them fixed.

This spec does not rename a file, a folder, a package, an id or the power name `skeleton-kit`. It does not change the dated records in `docs/acceptance/` or `.design-ref/`, because they say what was true on their day. It does not edit `README.md`. The folders `site/`, `power/` and `tests/` are named by the task, so the task touches more than one folder of the boundary table.

## Requirements

### Requirement 1: One spelling of the product name
**User Story:** As a reader of the site or the power, I want the product name spelled the same way everywhere, so that it looks like one product.

#### Acceptance Criteria
1. THE page title, the logo label and the logo text of `site/index.html` SHALL read "Skeleton Kit".
2. THE description of `power/skeleton-kit/plugin.json`, the first heading of `power/skeleton-kit/README.md` and the description of `power/skeleton-kit/skills/play-and-prove/SKILL.md` SHALL write "Skeleton Kit".
3. THE text files in `site/`, `power/`, `apps/`, `kit/` and `tools/` SHALL hold no "Skeleton kit" with a small k. Build outputs and installed packages are not read.
4. THE file names, folder names, package names, ids, the power name `skeleton-kit`, the environment names that start with `SKELETON_KIT_` and the search keyword `skeleton kit` SHALL stay as they are.
5. THE files in `docs/acceptance/` and `.design-ref/` SHALL stay as they are.
