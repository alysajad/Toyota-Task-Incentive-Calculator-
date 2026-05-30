"""Unit tests for the slab engine — the heart of the application."""
from decimal import Decimal

from django.test import SimpleTestCase

from .engine import Slab, calculate_incentive, next_tier, validate_slab_set

# The assignment's default slabs: 1–3 @ 1000, 4–7 @ 2000, 8+ @ 3500.
DEFAULT_SLABS = [
    Slab(1, 3, Decimal("1000")),
    Slab(4, 7, Decimal("2000")),
    Slab(8, None, Decimal("3500")),
]


class NextTierTests(SimpleTestCase):
    def test_points_to_the_next_higher_rate_tier(self):
        nxt = next_tier(2, DEFAULT_SLABS)
        self.assertIsNotNone(nxt)
        self.assertEqual(nxt.cars_to_next, 2)  # 2 -> 4 starts the 4–7 tier
        self.assertEqual(nxt.next_label, "4–7")
        self.assertEqual(nxt.next_rate, Decimal("2000"))
        # Whole-slab: 4 cars × 2000 = 8000, vs current 2 × 1000 = 2000 → +6000.
        self.assertEqual(nxt.payout_at_threshold, Decimal("8000"))
        self.assertEqual(nxt.uplift, Decimal("6000"))

    def test_top_tier_has_no_next(self):
        self.assertIsNone(next_tier(12, DEFAULT_SLABS))

    def test_zero_cars_points_to_first_tier(self):
        nxt = next_tier(0, DEFAULT_SLABS)
        self.assertIsNotNone(nxt)
        self.assertEqual(nxt.cars_to_next, 1)
        self.assertEqual(nxt.next_label, "1–3")


class CalculateIncentiveTests(SimpleTestCase):
    def test_worked_example_two_cars(self):
        result = calculate_incentive(2, DEFAULT_SLABS)
        self.assertTrue(result.matched)
        self.assertEqual(result.slab.label, "1–3")
        self.assertEqual(result.total_payout, Decimal("2000"))

    def test_worked_example_five_cars(self):
        result = calculate_incentive(5, DEFAULT_SLABS)
        self.assertEqual(result.slab.label, "4–7")
        self.assertEqual(result.total_payout, Decimal("10000"))

    def test_worked_example_eight_cars_open_ended(self):
        result = calculate_incentive(8, DEFAULT_SLABS)
        self.assertEqual(result.slab.label, "8+")
        self.assertEqual(result.total_payout, Decimal("28000"))

    def test_large_count_falls_into_open_ended_tier(self):
        result = calculate_incentive(100, DEFAULT_SLABS)
        self.assertEqual(result.slab.label, "8+")
        self.assertEqual(result.total_payout, Decimal("350000"))

    def test_zero_cars_pays_nothing_with_no_slab(self):
        result = calculate_incentive(0, DEFAULT_SLABS)
        self.assertTrue(result.matched)
        self.assertIsNone(result.slab)
        self.assertEqual(result.total_payout, Decimal("0"))

    def test_boundary_three_vs_four(self):
        self.assertEqual(calculate_incentive(3, DEFAULT_SLABS).slab.label, "1–3")
        self.assertEqual(calculate_incentive(4, DEFAULT_SLABS).slab.label, "4–7")

    def test_boundary_seven_vs_eight(self):
        self.assertEqual(calculate_incentive(7, DEFAULT_SLABS).slab.label, "4–7")
        self.assertEqual(calculate_incentive(8, DEFAULT_SLABS).slab.label, "8+")

    def test_negative_raises(self):
        with self.assertRaises(ValueError):
            calculate_incentive(-1, DEFAULT_SLABS)

    def test_unmatched_when_no_open_ended_tier(self):
        bounded = [Slab(1, 3, Decimal("1000"))]
        result = calculate_incentive(10, bounded)
        self.assertFalse(result.matched)
        self.assertEqual(result.total_payout, Decimal("0"))
        self.assertIn("does not fall into", result.message)


class ValidateSlabSetTests(SimpleTestCase):
    def test_default_slabs_are_valid(self):
        self.assertEqual(validate_slab_set(DEFAULT_SLABS), [])

    def test_empty_set_invalid(self):
        self.assertTrue(validate_slab_set([]))

    def test_must_start_at_one(self):
        slabs = [Slab(2, 5, Decimal("1000")), Slab(6, None, Decimal("2000"))]
        errors = validate_slab_set(slabs)
        self.assertTrue(any("start at 1" in e for e in errors))

    def test_gap_detected(self):
        slabs = [Slab(1, 3, Decimal("1000")), Slab(5, None, Decimal("2000"))]
        errors = validate_slab_set(slabs)
        self.assertTrue(any("Gap" in e for e in errors))

    def test_overlap_detected(self):
        slabs = [Slab(1, 4, Decimal("1000")), Slab(3, None, Decimal("2000"))]
        errors = validate_slab_set(slabs)
        self.assertTrue(any("overlap" in e for e in errors))

    def test_two_open_ended_invalid(self):
        slabs = [Slab(1, None, Decimal("1000")), Slab(2, None, Decimal("2000"))]
        errors = validate_slab_set(slabs)
        self.assertTrue(any("one open-ended" in e for e in errors))

    def test_max_less_than_min_invalid(self):
        slabs = [Slab(1, 0, Decimal("1000"))]
        self.assertTrue(validate_slab_set(slabs))

    def test_single_open_ended_from_one_is_valid(self):
        self.assertEqual(validate_slab_set([Slab(1, None, Decimal("1500"))]), [])
