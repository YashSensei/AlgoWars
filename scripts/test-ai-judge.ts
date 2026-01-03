/**
 * Comprehensive AI Judge Test
 * Tests all verdict types: ACCEPTED, WRONG_ANSWER, TLE, MLE, RTE, CE, INVALID
 * Run with: bun scripts/test-ai-judge.ts
 */

import { judgeCode } from "../src/services/ai-judge";

const PROBLEM = `
# Two Sum

Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

Example:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]

Constraints:
- 2 <= nums.length <= 10^5
- -10^9 <= nums[i] <= 10^9
- Only one valid answer exists.
`;

const tests = [
  {
    name: "Correct O(n) solution",
    expected: "ACCEPTED",
    language: "cpp17",
    code: `
#include <bits/stdc++.h>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> mp;
    for (int i = 0; i < nums.size(); i++) {
        int complement = target - nums[i];
        if (mp.count(complement)) {
            return {mp[complement], i};
        }
        mp[nums[i]] = i;
    }
    return {};
}
`,
  },
  {
    name: "O(n²) brute force - TLE",
    expected: "TIME_LIMIT",
    language: "cpp17",
    code: `
#include <bits/stdc++.h>
using namespace std;

// O(n^2) brute force - will TLE on n=10^5
vector<int> twoSum(vector<int>& nums, int target) {
    for (int i = 0; i < nums.size(); i++) {
        for (int j = i + 1; j < nums.size(); j++) {
            if (nums[i] + nums[j] == target) {
                return {i, j};
            }
        }
    }
    return {};
}
`,
  },
  {
    name: "Wrong logic - returns wrong indices",
    expected: "WRONG_ANSWER",
    language: "cpp17",
    code: `
#include <bits/stdc++.h>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    // Bug: always returns first two elements
    return {0, 1};
}
`,
  },
  {
    name: "Runtime error - division by zero",
    expected: "RUNTIME_ERROR",
    language: "cpp17",
    code: `
#include <bits/stdc++.h>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    int x = nums[0] / (nums[0] - nums[0]); // division by zero
    return {0, x};
}
`,
  },
  {
    name: "Syntax error - missing semicolon",
    expected: "COMPILE_ERROR",
    language: "cpp17",
    code: `
#include <bits/stdc++.h>
using namespace std

int main() {
    cout << "missing semicolon above"
}
`,
  },
  {
    name: "Empty/invalid code",
    expected: "INVALID_CODE",
    language: "python3",
    code: `
# TODO: implement this later
pass
`,
  },
  {
    name: "Python correct solution",
    expected: "ACCEPTED",
    language: "python3",
    code: `
def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
`,
  },
];

async function runTests() {
  console.log("🧪 Comprehensive AI Judge Test\n");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n📝 ${test.name}`);
    console.log("-".repeat(60));

    const result = await judgeCode(PROBLEM, test.code, test.language);

    const isPass = result.verdict === test.expected;
    const status = isPass ? "✅ PASS" : "❌ FAIL";

    console.log(`Language: ${test.language}`);
    console.log(`Expected: ${test.expected}`);
    console.log(`Actual:   ${result.verdict} (${result.confidence}%)`);
    console.log(`Feedback: ${result.feedback}`);
    console.log(`Status:   ${status}`);

    if (isPass) passed++;
    else failed++;
  }

  console.log("\n" + "=".repeat(60));
  console.log(`\n📊 Results: ${passed}/${tests.length} passed, ${failed} failed`);

  if (failed > 0) {
    console.log("\n⚠️  Some tests failed - AI judge may need prompt tuning");
  } else {
    console.log("\n🎉 All tests passed!");
  }
}

runTests().catch((e) => {
  console.error("❌ Test error:", e);
  process.exit(1);
});
