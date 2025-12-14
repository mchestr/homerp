"""
Prompt template management for AI services.

This module provides a PromptTemplateManager that loads prompt templates from files,
supports caching, and allows for custom template directories.
"""

from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, Template

# Default templates directory (bundled with the package)
_DEFAULT_TEMPLATES_PATH = Path(__file__).parent / "templates"


class PromptTemplateError(Exception):
    """Exception raised when template operations fail."""

    pass


class PromptTemplateManager:
    """
    Manages prompt templates for AI services.

    Templates are loaded from the filesystem and cached in memory.
    Supports Jinja2 templating for variable substitution.
    """

    def __init__(self, templates_dir: Path | str | None = None):
        """
        Initialize the template manager.

        Args:
            templates_dir: Path to custom templates directory.
                          If None, uses the default bundled templates.
        """
        if templates_dir is not None:
            self._templates_dir = Path(templates_dir)
        else:
            self._templates_dir = _DEFAULT_TEMPLATES_PATH

        self._env = Environment(
            loader=FileSystemLoader(str(self._templates_dir)),
            autoescape=False,  # Templates are text, not HTML
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self._cache: dict[str, Template] = {}

    @property
    def templates_dir(self) -> Path:
        """Return the templates directory path."""
        return self._templates_dir

    def _get_template_path(self, category: str, template_name: str) -> str:
        """
        Get the relative path to a template file.

        Args:
            category: Template category (e.g., "item_classification")
            template_name: Template name (e.g., "system" or "user")

        Returns:
            Relative path to the template file.
        """
        return f"{category}/{template_name}.txt"

    def _load_template(self, category: str, template_name: str) -> Template:
        """
        Load a template, using cache if available.

        Args:
            category: Template category (e.g., "item_classification")
            template_name: Template name (e.g., "system" or "user")

        Returns:
            Jinja2 Template object.

        Raises:
            PromptTemplateError: If the template cannot be loaded.
        """
        cache_key = f"{category}/{template_name}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        template_path = self._get_template_path(category, template_name)
        try:
            template = self._env.get_template(template_path)
            self._cache[cache_key] = template
            return template
        except Exception as e:
            raise PromptTemplateError(
                f"Failed to load template '{template_path}': {e}"
            ) from e

    def get_prompt(
        self, category: str, template_name: str, **variables: str | int | float | bool
    ) -> str:
        """
        Get a rendered prompt from a template.

        Args:
            category: Template category (e.g., "item_classification")
            template_name: Template name (e.g., "system" or "user")
            **variables: Variables to substitute in the template.

        Returns:
            The rendered prompt string.

        Raises:
            PromptTemplateError: If the template cannot be loaded or rendered.
        """
        template = self._load_template(category, template_name)
        try:
            return template.render(**variables)
        except Exception as e:
            raise PromptTemplateError(
                f"Failed to render template '{category}/{template_name}': {e}"
            ) from e

    def get_system_prompt(
        self, category: str, **variables: str | int | float | bool
    ) -> str:
        """
        Get the system prompt for a category.

        Args:
            category: Template category (e.g., "item_classification")
            **variables: Variables to substitute in the template.

        Returns:
            The rendered system prompt.
        """
        return self.get_prompt(category, "system", **variables)

    def get_user_prompt(
        self, category: str, **variables: str | int | float | bool
    ) -> str:
        """
        Get the user prompt for a category.

        Args:
            category: Template category (e.g., "item_classification")
            **variables: Variables to substitute in the template.

        Returns:
            The rendered user prompt.
        """
        return self.get_prompt(category, "user", **variables)

    def list_categories(self) -> list[str]:
        """
        List available template categories.

        Returns:
            List of category names.
        """
        categories = []
        if self._templates_dir.exists():
            for path in self._templates_dir.iterdir():
                if path.is_dir() and not path.name.startswith("_"):
                    categories.append(path.name)
        return sorted(categories)

    def template_exists(self, category: str, template_name: str) -> bool:
        """
        Check if a template exists.

        Args:
            category: Template category
            template_name: Template name

        Returns:
            True if the template exists, False otherwise.
        """
        template_path = self._templates_dir / category / f"{template_name}.txt"
        return template_path.exists()

    def clear_cache(self) -> None:
        """Clear the template cache."""
        self._cache.clear()


@lru_cache
def get_prompt_template_manager(
    templates_dir: str | None = None,
) -> PromptTemplateManager:
    """
    Get a cached PromptTemplateManager instance.

    Args:
        templates_dir: Optional custom templates directory path.

    Returns:
        PromptTemplateManager instance.
    """
    return PromptTemplateManager(templates_dir)
