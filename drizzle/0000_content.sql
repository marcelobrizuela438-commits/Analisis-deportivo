CREATE TABLE site_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content TEXT NOT NULL,
  revision INTEGER NOT NULL
);
