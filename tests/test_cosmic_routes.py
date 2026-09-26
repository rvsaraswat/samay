"""Contract tests for Ghadi's cosmic platform boundary."""

import unittest

from webapp.app import app


class CosmicRouteTests(unittest.TestCase):

  def setUp(self):
    self.client = app.test_client()

  def test_product_pages_render(self):
    for path in ("/today", "/cosmos", "/time-machine", "/festivals", "/events",
                 "/knowledge", "/birth-snapshot"):
      with self.subTest(path=path):
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"GHADI", response.data)

  def test_knowledge_contract(self):
    response = self.client.get("/api/knowledge/tithi")
    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json["slug"], "tithi")
    self.assertIn("body", response.json)

  def test_unknown_knowledge_topic_is_not_found(self):
    response = self.client.get("/api/knowledge/unknown-topic")
    self.assertEqual(response.status_code, 404)

  def test_invalid_birth_snapshot_is_bad_request(self):
    response = self.client.get("/api/cosmic/birth?datetime=not-a-date")
    self.assertEqual(response.status_code, 400)

  def test_unknown_planet_is_not_found(self):
    response = self.client.get("/api/cosmic/planet/unknown?date=2026-09-26")
    self.assertEqual(response.status_code, 404)
