# Changelog

## [1.0.1](https://github.com/heroku/js-blanket/compare/js-blanket-v1.0.0...js-blanket-v1.0.1) (2026-06-17)


### Dependencies

* bump actions/checkout from 4 to 6 ([#20](https://github.com/heroku/js-blanket/issues/20)) ([8efb2a1](https://github.com/heroku/js-blanket/commit/8efb2a1db9259a70549d05fbcdaee4f641bf86b8))
* bump actions/create-github-app-token from 2 to 3 ([#27](https://github.com/heroku/js-blanket/issues/27)) ([ca1ba8c](https://github.com/heroku/js-blanket/commit/ca1ba8ca9ff6b6a10ff5048cb1fcbfdeb51cf21e))
* bump actions/setup-node from 4 to 6 ([#19](https://github.com/heroku/js-blanket/issues/19)) ([cec0a6e](https://github.com/heroku/js-blanket/commit/cec0a6e5bc4677802dd1c3248e6394a2448e998a))
* bump flatted from 3.4.1 to 3.4.2 ([#29](https://github.com/heroku/js-blanket/issues/29)) ([6f27350](https://github.com/heroku/js-blanket/commit/6f2735065c218e06f646832672aff2d0534c3f49))
* fix high security vulns ([#35](https://github.com/heroku/js-blanket/issues/35)) ([2951a7b](https://github.com/heroku/js-blanket/commit/2951a7b55bef570ec565b20c98b6854a543b26a8))
* resolve audit vulnerabilities and tighten release tooling ([#39](https://github.com/heroku/js-blanket/issues/39)) ([59c30e0](https://github.com/heroku/js-blanket/commit/59c30e01dc11affae9a4cf5dce03920cd78774d8))

## [1.0.0](https://github.com/heroku/js-blanket/compare/js-blanket-v0.0.1...js-blanket-v1.0.0) (2025-11-19)


### Features

* Add generic redactor for logging library integration ([3ccb952](https://github.com/heroku/js-blanket/commit/3ccb9526d28d496c47b534af6160dfb7ef9bdba5))
* Add Sentry exception handler adapter with automatic PII scrubbing ([ee40e3e](https://github.com/heroku/js-blanket/commit/ee40e3e97544d630e16e6095ca3aeb8435823060))
* Adds core scrubber and initial functional wrapper ([edbaf1c](https://github.com/heroku/js-blanket/commit/edbaf1c294cad4b450c4193d510f2e739a8f4914))
* **bench:** add comprehensive performance benchmarks for core scrubber ([1d56ae4](https://github.com/heroku/js-blanket/commit/1d56ae406977cf470f23b2d0e706e2e92f58ffc7))
* Implement Scrubber class for sensitive data redaction ([20b0290](https://github.com/heroku/js-blanket/commit/20b02904ba51d01401ef9f3df05fca6b9c00d8c4))
* **sentry:** implement Sentry adapter with comprehensive tests and documentation ([f4117c0](https://github.com/heroku/js-blanket/commit/f4117c0a95bb780dbd8572313296f8a28ae082b9))


### Bug Fixes

* remove overly-aggressive patterns and presets ([43675ee](https://github.com/heroku/js-blanket/commit/43675ee1ad35bd0b01709bb942180b7ba36b8ede))
* update package.json for building and publishing ([e859733](https://github.com/heroku/js-blanket/commit/e85973335cf7f585b08462ac834582769fa4b590))
* **W-19894449:** remove overly-aggressive patterns and presets ([#5](https://github.com/heroku/js-blanket/issues/5)) ([43675ee](https://github.com/heroku/js-blanket/commit/43675ee1ad35bd0b01709bb942180b7ba36b8ede))


### Performance Improvements

* **logging:** add comprehensive performance benchmarks for generic logging adapter ([55d4d61](https://github.com/heroku/js-blanket/commit/55d4d61bb66e43c3ba51cd4a7a97d59d181c3311))


### Code Refactoring

* Remove Sentry integration adapter and examples ([f3a408c](https://github.com/heroku/js-blanket/commit/f3a408c745a7e3b92f41280f93e9be55caa3de10))
* **sentry:** streamline Sentry integration by consolidating initialization and scrubbing logic ([47ea979](https://github.com/heroku/js-blanket/commit/47ea979fe833150dafd411c576ec62736531ccbc))


### Documentation

* add comprehensive README with full feature documentation ([14c58ce](https://github.com/heroku/js-blanket/commit/14c58ce9beab57a2a870288623f3501fb9f89650))
* Adds Apache 2.0 license ([f7652c4](https://github.com/heroku/js-blanket/commit/f7652c4b5d175753c76410debb46e0d4f16546fe))
* Adds OSS required documentation ([fc59afa](https://github.com/heroku/js-blanket/commit/fc59afa2347285da13f86124e3e40d3d9a4ddb9d))
* **core:** add comprehensive JSDoc documentation to core scrubber ([790da5d](https://github.com/heroku/js-blanket/commit/790da5db85d63fbbfbef5112f458c80aa336db8f))
* Documentation updates ([9801da7](https://github.com/heroku/js-blanket/commit/9801da73409f79514a140f935cee14c3e3535358))
* **examples:** Add sentry examples and revise logging examples ([#3](https://github.com/heroku/js-blanket/issues/3)) ([23c402b](https://github.com/heroku/js-blanket/commit/23c402be3650a0e98d420d34b9e0707e5ebe3bc7))
* Fixes typo ([a52424e](https://github.com/heroku/js-blanket/commit/a52424e234dfbc1d3aa8d262a2610fae04ce957f))
* Fixes typo ([f718b2d](https://github.com/heroku/js-blanket/commit/f718b2d56e4dee783f71552c974d7bcf8c999314))
* **logging:** add comprehensive logging library integration examples ([9c3a8b1](https://github.com/heroku/js-blanket/commit/9c3a8b187773185f8f1c6f6654b88200be485902))
* **sentry:** add comprehensive Sentry integration examples for Node.js and browser ([09b3185](https://github.com/heroku/js-blanket/commit/09b3185446f4642f3dd8fc300c6d318c4591644b))
* Updates readme with full documentation ([3f90643](https://github.com/heroku/js-blanket/commit/3f906437df165ec0f77e905e4579e14eb3be39d5))


### Tests

* **logging:** add comprehensive tests for generic logging adapter ([e999190](https://github.com/heroku/js-blanket/commit/e99919006e9afecccc2977c53cf2e96a61072329))
* **scrubber:** achieve 100% coverage with comprehensive edge case tests ([5d92953](https://github.com/heroku/js-blanket/commit/5d929530225fd729bfaaef0ddf0ae31c3615cd06))
* **types:** add comprehensive type safety validation tests ([6319dc9](https://github.com/heroku/js-blanket/commit/6319dc9f869f93b740e96eea17bea36431c4a7de))


### Continuous Integration

* adding shared workflow usage for the release of js-blanket to npm ([7e33b78](https://github.com/heroku/js-blanket/commit/7e33b78694472e642900f83e6e35de63969690b6))


### Miscellaneous Chores

* Add demo script to package.json for easier testing ([2870671](https://github.com/heroku/js-blanket/commit/287067145598260c7b9c16a4114dca712a5380a1))
* adding shared workflow usage for the release of js-blanket to npm ([#8](https://github.com/heroku/js-blanket/issues/8)) ([7e33b78](https://github.com/heroku/js-blanket/commit/7e33b78694472e642900f83e6e35de63969690b6))
* Adds github CI workflow, copilot instructions, and PR template ([db425e8](https://github.com/heroku/js-blanket/commit/db425e85c7fd6150351754d39a0a23bde3cfce67))
* Fixed lint-staged formatting file pattern ([d52fc57](https://github.com/heroku/js-blanket/commit/d52fc5787d8fca3a66eb4871625e7cdc2926d90e))
* Fixes for code quality configurations ([0d5d1ef](https://github.com/heroku/js-blanket/commit/0d5d1efe4094ad6b1423fce9e1e905bf48ea4044))
* initial repository setup with build tooling and code quality standards ([9414006](https://github.com/heroku/js-blanket/commit/941400604bd8858ba974f1510c5cd23fab8cc647))
* release 1.0.0 ([53704bb](https://github.com/heroku/js-blanket/commit/53704bb383abcb75ba623d0f43039859a8eb0c7b))
* Resolves typescript warnings ([b36bf08](https://github.com/heroku/js-blanket/commit/b36bf081ff0ea343b9a51aaaf145344b0d7f4249))
* Update coverage configuration and add initial tests ([cc468ec](https://github.com/heroku/js-blanket/commit/cc468ecc639f1fcbdbc7a1902b2389882c5e12a7))
* update package.json for building and publishing ([#6](https://github.com/heroku/js-blanket/issues/6)) ([e859733](https://github.com/heroku/js-blanket/commit/e85973335cf7f585b08462ac834582769fa4b590))
* Update release-please configs ([#9](https://github.com/heroku/js-blanket/issues/9)) ([57f2edb](https://github.com/heroku/js-blanket/commit/57f2edb81331fb69327c36e33e932b6c59d65388))
* Update TypeScript configuration to include tsBuildInfoFile ([bfc146a](https://github.com/heroku/js-blanket/commit/bfc146aefa6b85132ee0d3918db6c8d12f12c1b0))
