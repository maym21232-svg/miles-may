import unittest

from focus_pool import balanced_limit


class FocusPoolTest(unittest.TestCase):
    def test_sector_limit_and_fill(self):
        rows = [
            {"symbol": "A1", "sector": "A"}, {"symbol": "A2", "sector": "A"},
            {"symbol": "A3", "sector": "A"}, {"symbol": "B1", "sector": "B"},
            {"symbol": "B2", "sector": "B"}, {"symbol": "C1", "sector": "C"},
        ]
        self.assertEqual([row["symbol"] for row in balanced_limit(rows, 4, 2)],
                         ["A1", "A2", "B1", "B2"])
        self.assertEqual(len(balanced_limit(rows, 6, 2)), 6)

    def test_deduplicates_symbols(self):
        rows = [{"symbol": "A", "sector": "A"}, {"symbol": "A", "sector": "B"},
                {"symbol": "B", "sector": "B"}]
        self.assertEqual([row["symbol"] for row in balanced_limit(rows, 3, 2)], ["A", "B"])


if __name__ == "__main__":
    unittest.main()
