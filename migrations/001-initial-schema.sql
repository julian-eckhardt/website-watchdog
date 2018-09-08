-- UP
CREATE TABLE users (id INTEGER PRIMARY KEY, first_name TEXT);
CREATE TABLE target_sites (site_url TEXT NOT NULL, response_hash TEXT);

-- DOWN
DROP TABLE users;
DROP TABLE target_sites;