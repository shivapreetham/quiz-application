# JSON Import Feature for Quiz Questions

## Overview
The admin panel now includes a JSON import feature that allows you to bulk upload questions to your quiz, making it much easier to create large question banks.

## How to Use

1. **Navigate to Admin Panel**
   - Log in with your admin password
   - Select or create a quiz room

2. **Go to "Import JSON" Tab**
   - You'll find this tab in the admin panel navigation

3. **Prepare Your JSON**
   - Use the format shown below
   - You can click "Load Sample" to see an example

4. **Import Questions**
   - Paste your JSON into the text area
   - Click "Import Questions"
   - The system will validate and import all questions

## JSON Format

```json
[
  {
    "title": "Question title here",
    "description": "Question description or context",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": 1
  }
]
```

### Field Descriptions

- **title** (string, required): The main question text
- **description** (string, required): Additional context or clarification
- **options** (array of strings, required): Answer choices (minimum 2 options)
- **answer** (number, required): Index of the correct answer (0-based)
  - 0 = first option
  - 1 = second option
  - 2 = third option
  - etc.

## Example

```json
[
  {
    "title": "What is the capital of France?",
    "description": "Choose the correct capital city",
    "options": ["London", "Paris", "Berlin", "Madrid"],
    "answer": 1
  },
  {
    "title": "What is 2 + 2?",
    "description": "Basic arithmetic",
    "options": ["3", "4", "5"],
    "answer": 1
  }
]
```

## Validation Rules

The system validates:
- ✅ JSON must be a valid array
- ✅ Each question must have all required fields
- ✅ Options must be an array with at least 2 items
- ✅ Answer index must be valid (within options array bounds)
- ✅ All strings must be non-empty

## Tips

1. **Use a JSON validator** before importing to catch syntax errors
2. **Test with a small batch** first to ensure your format is correct
3. **Keep a backup** of your JSON in a file for future use
4. **Use the sample file** (`sample-questions.json`) as a template

## Sample Questions File

A sample questions file (`sample-questions.json`) is included in the root directory with 10 example questions you can use as a template.

## Benefits

- 📝 **Faster Setup**: Import dozens of questions in seconds
- 🔄 **Reusable**: Save your JSON files for future quizzes
- ✅ **Validated**: Automatic validation catches errors before import
- 🎯 **Organized**: Easy to review and edit questions in JSON format

## Troubleshooting

**"Invalid JSON format"**
- Check for missing commas, brackets, or quotes
- Ensure the JSON is a valid array

**"Question X: Missing or invalid title"**
- Make sure each question has a "title" field
- Ensure the title is a non-empty string

**"Question X: Must have at least 2 options"**
- Add more options to the question
- Ensure "options" is an array with at least 2 items

**"Question X: Invalid answer index"**
- Make sure the answer is a number
- Ensure the number is within the range of your options (0 to options.length - 1)
