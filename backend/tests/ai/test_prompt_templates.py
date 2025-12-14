"""Tests for AI prompt template management."""

import tempfile
from pathlib import Path

import pytest

from src.ai.prompt_templates import (
    PromptTemplateError,
    PromptTemplateManager,
    get_prompt_template_manager,
)


class TestPromptTemplateManager:
    """Tests for the PromptTemplateManager class."""

    def test_default_templates_dir_exists(self):
        """Default templates directory should exist and contain templates."""
        manager = PromptTemplateManager()
        assert manager.templates_dir.exists()
        assert manager.templates_dir.is_dir()

    def test_list_categories_returns_expected_categories(self):
        """Should list the expected template categories."""
        manager = PromptTemplateManager()
        categories = manager.list_categories()
        assert "item_classification" in categories
        assert "location_analysis" in categories

    def test_template_exists_for_item_classification(self):
        """Item classification templates should exist."""
        manager = PromptTemplateManager()
        assert manager.template_exists("item_classification", "system")
        assert manager.template_exists("item_classification", "user")

    def test_template_exists_for_location_analysis(self):
        """Location analysis templates should exist."""
        manager = PromptTemplateManager()
        assert manager.template_exists("location_analysis", "system")
        assert manager.template_exists("location_analysis", "user")

    def test_template_not_exists_for_invalid_category(self):
        """Should return False for non-existent templates."""
        manager = PromptTemplateManager()
        assert not manager.template_exists("nonexistent", "system")
        assert not manager.template_exists("item_classification", "nonexistent")

    def test_get_system_prompt_returns_string(self):
        """get_system_prompt should return a non-empty string."""
        manager = PromptTemplateManager()
        prompt = manager.get_system_prompt("item_classification")
        assert isinstance(prompt, str)
        assert len(prompt) > 0

    def test_get_user_prompt_returns_string(self):
        """get_user_prompt should return a non-empty string."""
        manager = PromptTemplateManager()
        prompt = manager.get_user_prompt("item_classification")
        assert isinstance(prompt, str)
        assert len(prompt) > 0

    def test_item_classification_system_prompt_content(self):
        """Item classification system prompt should contain expected content."""
        manager = PromptTemplateManager()
        prompt = manager.get_system_prompt("item_classification")
        assert "inventory" in prompt.lower()
        assert "classification" in prompt.lower()
        assert "confidence" in prompt.lower()

    def test_item_classification_user_prompt_content(self):
        """Item classification user prompt should contain expected JSON structure."""
        manager = PromptTemplateManager()
        prompt = manager.get_user_prompt("item_classification")
        assert "identified_name" in prompt
        assert "confidence" in prompt
        assert "category_path" in prompt
        assert "JSON" in prompt

    def test_location_analysis_system_prompt_content(self):
        """Location analysis system prompt should contain expected content."""
        manager = PromptTemplateManager()
        prompt = manager.get_system_prompt("location_analysis")
        assert "storage" in prompt.lower()
        assert "compartment" in prompt.lower()

    def test_location_analysis_user_prompt_content(self):
        """Location analysis user prompt should contain expected JSON structure."""
        manager = PromptTemplateManager()
        prompt = manager.get_user_prompt("location_analysis")
        assert "parent" in prompt
        assert "children" in prompt
        assert "location_type" in prompt

    def test_templates_are_cached(self):
        """Templates should be cached after first load."""
        manager = PromptTemplateManager()
        # Load the template twice
        prompt1 = manager.get_system_prompt("item_classification")
        prompt2 = manager.get_system_prompt("item_classification")
        # Should return identical content
        assert prompt1 == prompt2
        # Cache should contain the template
        assert "item_classification/system" in manager._cache

    def test_clear_cache(self):
        """clear_cache should empty the cache."""
        manager = PromptTemplateManager()
        # Load a template to populate cache
        manager.get_system_prompt("item_classification")
        assert len(manager._cache) > 0
        # Clear the cache
        manager.clear_cache()
        assert len(manager._cache) == 0

    def test_invalid_category_raises_error(self):
        """Getting a prompt from invalid category should raise error."""
        manager = PromptTemplateManager()
        with pytest.raises(PromptTemplateError):
            manager.get_prompt("nonexistent_category", "system")

    def test_invalid_template_name_raises_error(self):
        """Getting a prompt with invalid template name should raise error."""
        manager = PromptTemplateManager()
        with pytest.raises(PromptTemplateError):
            manager.get_prompt("item_classification", "nonexistent")


class TestCustomTemplatesDir:
    """Tests for custom templates directory functionality."""

    def test_custom_templates_dir(self):
        """Should be able to use a custom templates directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create custom template structure
            custom_dir = Path(tmpdir)
            category_dir = custom_dir / "custom_category"
            category_dir.mkdir()

            # Create a custom template
            (category_dir / "system.txt").write_text("Custom system prompt")
            (category_dir / "user.txt").write_text("Custom user prompt")

            # Use custom directory
            manager = PromptTemplateManager(templates_dir=custom_dir)

            assert manager.templates_dir == custom_dir
            assert "custom_category" in manager.list_categories()
            assert (
                manager.get_system_prompt("custom_category") == "Custom system prompt"
            )
            assert manager.get_user_prompt("custom_category") == "Custom user prompt"

    def test_jinja2_variable_substitution(self):
        """Templates should support Jinja2 variable substitution."""
        with tempfile.TemporaryDirectory() as tmpdir:
            custom_dir = Path(tmpdir)
            category_dir = custom_dir / "test_category"
            category_dir.mkdir()

            # Create template with variable
            (category_dir / "system.txt").write_text("Hello, {{ name }}!")

            manager = PromptTemplateManager(templates_dir=custom_dir)
            prompt = manager.get_system_prompt("test_category", name="World")
            assert prompt == "Hello, World!"

    def test_jinja2_conditional_template(self):
        """Templates should support Jinja2 conditionals."""
        with tempfile.TemporaryDirectory() as tmpdir:
            custom_dir = Path(tmpdir)
            category_dir = custom_dir / "test_category"
            category_dir.mkdir()

            # Create template with conditional
            template_content = """{% if detailed %}
Detailed instructions here.
{% else %}
Brief instructions.
{% endif %}"""
            (category_dir / "system.txt").write_text(template_content)

            manager = PromptTemplateManager(templates_dir=custom_dir)

            prompt_detailed = manager.get_system_prompt("test_category", detailed=True)
            assert "Detailed instructions here." in prompt_detailed

            prompt_brief = manager.get_system_prompt("test_category", detailed=False)
            assert "Brief instructions." in prompt_brief


class TestGetPromptTemplateManager:
    """Tests for the cached manager factory function."""

    def test_returns_manager_instance(self):
        """Should return a PromptTemplateManager instance."""
        # Clear the cache to ensure clean state
        get_prompt_template_manager.cache_clear()

        manager = get_prompt_template_manager()
        assert isinstance(manager, PromptTemplateManager)

    def test_caches_manager(self):
        """Should return the same cached instance."""
        # Clear the cache to ensure clean state
        get_prompt_template_manager.cache_clear()

        manager1 = get_prompt_template_manager()
        manager2 = get_prompt_template_manager()
        assert manager1 is manager2

    def test_different_dirs_get_different_managers(self):
        """Different template dirs should get different managers."""
        # Clear the cache
        get_prompt_template_manager.cache_clear()

        with (
            tempfile.TemporaryDirectory() as tmpdir1,
            tempfile.TemporaryDirectory() as tmpdir2,
        ):
            manager1 = get_prompt_template_manager(tmpdir1)
            manager2 = get_prompt_template_manager(tmpdir2)
            assert manager1 is not manager2
