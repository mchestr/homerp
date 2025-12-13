"""Tests for AI quantity estimate parsing."""

import pytest

from src.ai.service import parse_quantity_estimate


class TestParseQuantityEstimate:
    """Tests for the parse_quantity_estimate function."""

    def test_none_input_returns_defaults(self):
        """None input should return quantity=1 and unit=pcs."""
        result = parse_quantity_estimate(None)
        assert result == {"quantity": 1, "quantity_unit": "pcs"}

    def test_empty_string_returns_defaults(self):
        """Empty string should return quantity=1 and unit=pcs."""
        result = parse_quantity_estimate("")
        assert result == {"quantity": 1, "quantity_unit": "pcs"}

    def test_whitespace_only_returns_defaults(self):
        """Whitespace-only string should return defaults."""
        result = parse_quantity_estimate("   ")
        assert result == {"quantity": 1, "quantity_unit": "pcs"}

    @pytest.mark.parametrize(
        "estimate,expected_quantity,expected_unit",
        [
            ("5 pieces", 5, "pcs"),
            ("10 pcs", 10, "pcs"),
            ("3 items", 3, "pcs"),
            ("1 piece", 1, "pcs"),
            ("25 units", 25, "pcs"),
        ],
    )
    def test_simple_pieces_format(self, estimate, expected_quantity, expected_unit):
        """Test simple 'N pieces' format."""
        result = parse_quantity_estimate(estimate)
        assert result["quantity"] == expected_quantity
        assert result["quantity_unit"] == expected_unit

    @pytest.mark.parametrize(
        "estimate,expected_quantity,expected_unit",
        [
            ("approximately 10", 10, "pcs"),
            ("about 5 pieces", 5, "pcs"),
            ("around 25", 25, "pcs"),
            ("roughly 15 items", 15, "pcs"),
            ("maybe 8", 8, "pcs"),
        ],
    )
    def test_approximate_format(self, estimate, expected_quantity, expected_unit):
        """Test approximate quantity formats."""
        result = parse_quantity_estimate(estimate)
        assert result["quantity"] == expected_quantity
        assert result["quantity_unit"] == expected_unit

    @pytest.mark.parametrize(
        "estimate,expected_quantity,expected_unit",
        [
            ("10m", 10, "m"),
            ("5kg", 5, "kg"),
            ("25cm", 25, "cm"),
            ("100mm", 100, "mm"),
            ("2L", 2, "L"),
            ("500ml", 500, "mL"),
        ],
    )
    def test_direct_unit_abbreviation(self, estimate, expected_quantity, expected_unit):
        """Test direct number+unit format like '10m' or '5kg'."""
        result = parse_quantity_estimate(estimate)
        assert result["quantity"] == expected_quantity
        assert result["quantity_unit"] == expected_unit

    @pytest.mark.parametrize(
        "estimate,expected_quantity,expected_unit",
        [
            ("10 meters of cable", 10, "m"),
            ("about 25 meters", 25, "m"),
            ("5 kilograms", 5, "kg"),
            ("100 grams", 100, "g"),
            ("2 liters", 2, "L"),
            ("3 feet", 3, "ft"),
            ("12 inches", 12, "in"),
        ],
    )
    def test_full_unit_names(self, estimate, expected_quantity, expected_unit):
        """Test full unit name formats."""
        result = parse_quantity_estimate(estimate)
        assert result["quantity"] == expected_quantity
        assert result["quantity_unit"] == expected_unit

    @pytest.mark.parametrize(
        "estimate,expected_quantity,expected_unit",
        [
            ("3 boxes", 3, "boxes"),
            ("2 packs", 2, "packs"),
            ("1 bag", 1, "bags"),
            ("5 rolls", 5, "rolls"),
            ("2 sets", 2, "sets"),
            ("4 pairs", 4, "pairs"),
        ],
    )
    def test_container_units(self, estimate, expected_quantity, expected_unit):
        """Test container/package unit formats."""
        result = parse_quantity_estimate(estimate)
        assert result["quantity"] == expected_quantity
        assert result["quantity_unit"] == expected_unit

    @pytest.mark.parametrize(
        "estimate,expected_quantity,expected_unit",
        [
            ("2.5 meters", 2, "m"),
            ("3.7 kg", 3, "kg"),
            ("10.9 pieces", 10, "pcs"),
        ],
    )
    def test_decimal_quantities_truncated(
        self, estimate, expected_quantity, expected_unit
    ):
        """Test that decimal quantities are truncated to integers."""
        result = parse_quantity_estimate(estimate)
        assert result["quantity"] == expected_quantity
        assert result["quantity_unit"] == expected_unit

    def test_zero_quantity_becomes_one(self):
        """Zero quantity should become 1."""
        result = parse_quantity_estimate("0 pieces")
        assert result["quantity"] == 1
        assert result["quantity_unit"] == "pcs"

    @pytest.mark.parametrize(
        "estimate",
        [
            "5 PIECES",
            "5 Pieces",
            "5 METERS",
            "5 Meters",
            "APPROXIMATELY 10",
        ],
    )
    def test_case_insensitivity(self, estimate):
        """Test that parsing is case-insensitive."""
        result = parse_quantity_estimate(estimate)
        assert result["quantity"] > 0

    def test_unparseable_returns_defaults(self):
        """Unparseable strings should return defaults."""
        result = parse_quantity_estimate("some random text without numbers")
        assert result == {"quantity": 1, "quantity_unit": "pcs"}

    def test_weight_units(self):
        """Test weight unit parsing."""
        assert parse_quantity_estimate("5 pounds") == {
            "quantity": 5,
            "quantity_unit": "lb",
        }
        assert parse_quantity_estimate("5 lbs") == {
            "quantity": 5,
            "quantity_unit": "lb",
        }
        assert parse_quantity_estimate("10 ounces") == {
            "quantity": 10,
            "quantity_unit": "oz",
        }
        assert parse_quantity_estimate("10 oz") == {
            "quantity": 10,
            "quantity_unit": "oz",
        }
