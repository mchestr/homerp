"""Tests for webhook template utilities."""

from src.webhooks.template import (
    build_default_payload,
    escape_json_string,
    get_nested_value,
    render_template,
)


class TestEscapeJsonString:
    """Tests for escape_json_string function."""

    def test_simple_string(self):
        """Simple strings pass through unchanged."""
        assert escape_json_string("hello world") == "hello world"

    def test_string_with_double_quotes(self):
        """Double quotes are escaped."""
        assert escape_json_string('say "hello"') == 'say \\"hello\\"'

    def test_string_with_backslash(self):
        """Backslashes are escaped."""
        assert escape_json_string("path\\to\\file") == "path\\\\to\\\\file"

    def test_string_with_newline(self):
        """Newlines are escaped."""
        assert escape_json_string("line1\nline2") == "line1\\nline2"

    def test_string_with_tab(self):
        """Tabs are escaped."""
        assert escape_json_string("col1\tcol2") == "col1\\tcol2"

    def test_string_with_carriage_return(self):
        """Carriage returns are escaped."""
        assert escape_json_string("line1\rline2") == "line1\\rline2"

    def test_unicode_characters(self):
        """Unicode characters are handled correctly (escaped or preserved)."""
        import json

        result = escape_json_string("café ☕")
        # The escaped string should decode back to the original when parsed as JSON
        # json.dumps may escape non-ASCII as \uXXXX which is valid JSON
        parsed = json.loads(f'"{result}"')
        assert parsed == "café ☕"

    def test_complex_string(self):
        """Complex strings with multiple special chars are handled."""
        input_str = 'User said: "It\'s a test"\nWith multiple lines'
        expected = 'User said: \\"It\'s a test\\"\\nWith multiple lines'
        assert escape_json_string(input_str) == expected


class TestGetNestedValue:
    """Tests for get_nested_value function."""

    def test_simple_key(self):
        """Simple key lookup works."""
        data = {"name": "John"}
        assert get_nested_value(data, "name") == "John"

    def test_nested_key(self):
        """Nested key lookup works."""
        data = {"user": {"name": "John", "email": "john@example.com"}}
        assert get_nested_value(data, "user.name") == "John"
        assert get_nested_value(data, "user.email") == "john@example.com"

    def test_deeply_nested(self):
        """Deeply nested lookup works."""
        data = {"level1": {"level2": {"level3": "value"}}}
        assert get_nested_value(data, "level1.level2.level3") == "value"

    def test_missing_key(self):
        """Missing keys return None."""
        data = {"name": "John"}
        assert get_nested_value(data, "email") is None

    def test_missing_nested_key(self):
        """Missing nested keys return None."""
        data = {"user": {"name": "John"}}
        assert get_nested_value(data, "user.email") is None
        assert get_nested_value(data, "other.field") is None

    def test_non_dict_intermediate(self):
        """Non-dict intermediate values return None."""
        data = {"user": "John"}
        assert get_nested_value(data, "user.name") is None


class TestRenderTemplate:
    """Tests for render_template function."""

    def test_simple_variable(self):
        """Simple variable substitution works."""
        template = '{"name": "{{name}}"}'
        context = {"name": "John"}
        assert render_template(template, context) == '{"name": "John"}'

    def test_nested_variable(self):
        """Nested variable substitution works."""
        template = '{"email": "{{user.email}}"}'
        context = {"user": {"email": "john@example.com"}}
        assert render_template(template, context) == '{"email": "john@example.com"}'

    def test_multiple_variables(self):
        """Multiple variables in template work."""
        template = '{"name": "{{user.name}}", "email": "{{user.email}}"}'
        context = {"user": {"name": "John", "email": "john@example.com"}}
        expected = '{"name": "John", "email": "john@example.com"}'
        assert render_template(template, context) == expected

    def test_missing_variable(self):
        """Missing variables become empty strings."""
        template = '{"name": "{{name}}", "email": "{{email}}"}'
        context = {"name": "John"}
        assert render_template(template, context) == '{"name": "John", "email": ""}'

    def test_variable_with_spaces(self):
        """Variables with spaces in braces work."""
        template = '{"name": "{{ name }}"}'
        context = {"name": "John"}
        assert render_template(template, context) == '{"name": "John"}'

    def test_special_chars_in_value_are_escaped(self):
        """Special characters in values are properly escaped for JSON."""
        template = '{"message": "{{message}}"}'
        context = {"message": 'User said "hello"'}
        result = render_template(template, context)
        assert result == '{"message": "User said \\"hello\\""}'

    def test_newlines_in_value_are_escaped(self):
        """Newlines in values are properly escaped for JSON."""
        template = '{"message": "{{message}}"}'
        context = {"message": "line1\nline2"}
        result = render_template(template, context)
        assert result == '{"message": "line1\\nline2"}'

    def test_complex_user_input_is_escaped(self):
        """Complex user input with quotes is properly escaped.

        This is the exact bug case from production where user input
        like 'Able to have negative "currently out"' broke JSON parsing.
        """
        template = '{"issue_text": "{{feedback.message}}"}'
        context = {"feedback": {"message": 'Able to have negative "currently out"'}}
        result = render_template(template, context)
        expected = '{"issue_text": "Able to have negative \\"currently out\\""}'
        assert result == expected

        # Verify the result is valid JSON
        import json

        parsed = json.loads(result)
        assert parsed["issue_text"] == 'Able to have negative "currently out"'

    def test_non_string_values(self):
        """Non-string values are converted to strings."""
        template = '{"count": {{count}}}'
        context = {"count": 42}
        assert render_template(template, context) == '{"count": 42}'

    def test_boolean_values(self):
        """Boolean values work correctly."""
        template = '{"active": {{active}}}'
        context = {"active": True}
        assert render_template(template, context) == '{"active": True}'


class TestBuildDefaultPayload:
    """Tests for build_default_payload function."""

    def test_basic_payload(self):
        """Basic payload structure is correct."""
        context = {"id": "123", "timestamp": "2024-01-01T00:00:00Z"}
        result = build_default_payload("test.event", context)

        assert result["event"] == "test.event"
        assert result["timestamp"] == "2024-01-01T00:00:00Z"
        assert result["data"] == context

    def test_payload_with_nested_data(self):
        """Payload with nested data works."""
        context = {
            "timestamp": "2024-01-01T00:00:00Z",
            "feedback": {"id": "123", "message": "test"},
        }
        result = build_default_payload("feedback.created", context)

        assert result["event"] == "feedback.created"
        assert result["data"]["feedback"]["id"] == "123"
