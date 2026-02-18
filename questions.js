// ===============================
// CompileRace — Questions Bank
// ===============================

window.JAVA_TEMPLATE = `import java.util.Scanner;
class Main{
  public static void main(String[] args){
    Scanner sc = new Scanner(System.in);
    {{CODE}}
  }
}
`;

window.QUESTIONS = [
  {
    id: "hello-world",
    title: "Print Hello World",
    difficulty: "Easy",
    tags: ["output"],
    objective: 'Print "Hello World".',
    sample: { input: "", output: "Hello World" },
    tests: [{ stdin: "", out: "Hello World" }]
  },
  {
    id: "addition",
    title: "Addition of Two Numbers",
    difficulty: "Easy",
    tags: ["math", "input"],
    objective: "Read two integers a and b. Print a + b.",
    sample: { input: "1 2", output: "3" },
    tests: [
      { stdin: "20 6", out: "26" },
      { stdin: "0 0", out: "0" },
      { stdin: "-5 9", out: "4" },
      { stdin: "999 1", out: "1000" },
      { stdin: "7 -3", out: "4" },
      { stdin: "-10 -20", out: "-30" }
    ]
  },
  {
    id: "subtraction",
    title: "Subtraction of Two Numbers",
    difficulty: "Easy",
    tags: ["math", "input"],
    objective: "Read two integers a and b. Print a - b.",
    sample: { input: "10 4", output: "6" },
    tests: [
      { stdin: "20 6", out: "14" },
      { stdin: "0 0", out: "0" },
      { stdin: "5 9", out: "-4" },
      { stdin: "-5 9", out: "-14" },
      { stdin: "9 -12", out: "21" },
      { stdin: "-10 -20", out: "10" }
    ]
  },
  {
    id: "multiplication",
    title: "Multiplication of Two Numbers",
    difficulty: "Easy",
    tags: ["math", "input"],
    objective: "Read two integers a and b. Print a * b.",
    sample: { input: "3 5", output: "15" },
    tests: [
      { stdin: "20 6", out: "120" },
      { stdin: "0 99", out: "0" },
      { stdin: "-5 9", out: "-45" },
      { stdin: "-7 -3", out: "21" },
      { stdin: "12 -4", out: "-48" },
      { stdin: "1 1000", out: "1000" }
    ]
  },
  {
    id: "division-quotient",
    title: "Division Quotient (Integer)",
    difficulty: "Easy",
    tags: ["math", "input"],
    objective: "Read two integers a and b. Print integer quotient a / b.",
    sample: { input: "7 2", output: "3" },
    tests: [
      { stdin: "20 6", out: "3" },
      { stdin: "7 2", out: "3" },
      { stdin: "10 5", out: "2" },
      { stdin: "9 3", out: "3" },
      { stdin: "-7 2", out: "-3" },
      { stdin: "7 -2", out: "-3" }
    ]
  },
  {
    id: "division-remainder",
    title: "Division Remainder (Modulus)",
    difficulty: "Easy",
    tags: ["math", "input"],
    objective: "Read two integers a and b. Print remainder a % b.",
    sample: { input: "7 2", output: "1" },
    tests: [
      { stdin: "20 6", out: "2" },
      { stdin: "7 2", out: "1" },
      { stdin: "10 5", out: "0" },
      { stdin: "9 4", out: "1" },
      { stdin: "-7 2", out: "-1" },
      { stdin: "7 -2", out: "1" }
    ]
  },
  {
    id: "greater-of-two",
    title: "Greater of Two Numbers",
    difficulty: "Easy",
    tags: ["if-else", "input"],
    objective: "Read two integers a and b. Print the greater number.",
    sample: { input: "9 12", output: "12" },
    tests: [
      { stdin: "9 12", out: "12" },
      { stdin: "12 9", out: "12" },
      { stdin: "-5 -9", out: "-5" },
      { stdin: "-10 0", out: "0" },
      { stdin: "7 7", out: "7" },
      { stdin: "100 1", out: "100" }
    ]
  },
  {
    id: "lesser-of-two",
    title: "Lesser of Two Numbers",
    difficulty: "Easy",
    tags: ["if-else", "input"],
    objective: "Read two integers a and b. Print the smaller number.",
    sample: { input: "9 12", output: "9" },
    tests: [
      { stdin: "9 12", out: "9" },
      { stdin: "12 9", out: "9" },
      { stdin: "-5 -9", out: "-9" },
      { stdin: "-10 0", out: "-10" },
      { stdin: "7 7", out: "7" },
      { stdin: "100 1", out: "1" }
    ]
  },

  // ✅ FIXED: even-checker now has deterministic output for all inputs
  {
    id: "even-checker",
    title: "Even Checker",
    difficulty: "Easy",
    tags: ["if-else", "math", "input"],
    objective: 'Read integer n. Print "Even" if n is even, otherwise print "Odd".',
    sample: { input: "18", output: "Even" },
    tests: [
      { stdin: "18", out: "Even" },
      { stdin: "0", out: "Even" },
      { stdin: "-2", out: "Even" },
      { stdin: "7", out: "Odd" },
      { stdin: "-9", out: "Odd" }
    ]
  },

  // ✅ FIXED: odd-checker now has deterministic output for all inputs
  {
    id: "odd-checker",
    title: "Odd Checker",
    difficulty: "Easy",
    tags: ["if-else", "math", "input"],
    objective: 'Read integer n. Print "Odd" if n is odd, otherwise print "Even".',
    sample: { input: "19", output: "Odd" },
    tests: [
      { stdin: "19", out: "Odd" },
      { stdin: "7", out: "Odd" },
      { stdin: "-9", out: "Odd" },
      { stdin: "0", out: "Even" },
      { stdin: "18", out: "Even" }
    ]
  },

  {
    id: "sum-of-digits",
    title: "Sum of Digits",
    difficulty: "Easy",
    tags: ["loops", "math", "input"],
    objective: "Read integer n. Print the sum of its digits.",
    sample: { input: "1234", output: "10" },
    tests: [
      { stdin: "120450", out: "12" },
      { stdin: "0", out: "0" },
      { stdin: "5", out: "5" },
      { stdin: "999", out: "27" },
      { stdin: "1000", out: "1" },
      { stdin: "987654", out: "39" }
    ]
  },

  // 🟡 MEDIUM
  {
    id: "fizzbuzz",
    title: "FizzBuzz",
    difficulty: "Medium",
    tags: ["loops", "if-else"],
    objective: "Read integer n. For 1 to n: print FizzBuzz if div by 3&5, Fizz if by 3, Buzz if by 5, else the number.",
    sample: { input: "5", output: "1\n2\nFizz\n4\nBuzz" },
    tests: [
      { stdin: "5", out: "1\n2\nFizz\n4\nBuzz" },
      { stdin: "15", out: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz" }
    ]
  },
  {
    id: "factorial",
    title: "Factorial",
    difficulty: "Medium",
    tags: ["loops", "math", "input"],
    objective: "Read integer n. Print n! (factorial of n).",
    sample: { input: "5", output: "120" },
    tests: [
      { stdin: "0", out: "1" },
      { stdin: "1", out: "1" },
      { stdin: "5", out: "120" },
      { stdin: "10", out: "3628800" }
    ]
  },
  {
    id: "reverse-string",
    title: "Reverse a String",
    difficulty: "Medium",
    tags: ["string", "input"],
    objective: "Read a string s. Print it reversed.",
    sample: { input: "hello", output: "olleh" },
    tests: [
      { stdin: "hello", out: "olleh" },
      { stdin: "java", out: "avaj" },
      { stdin: "racecar", out: "racecar" },
      { stdin: "abc", out: "cba" }
    ]
  },
  {
    id: "palindrome",
    title: "Palindrome Check",
    difficulty: "Medium",
    tags: ["string", "if-else", "input"],
    objective: 'Read a string s. Print "Yes" if it is a palindrome, else "No".',
    sample: { input: "racecar", output: "Yes" },
    tests: [
      { stdin: "racecar", out: "Yes" },
      { stdin: "hello", out: "No" },
      { stdin: "madam", out: "Yes" },
      { stdin: "abc", out: "No" }
    ]
  }
];
