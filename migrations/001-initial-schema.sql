-- This file is part of website-watchdog.
--
-- website-watchdog is free software: you can redistribute it and/or modify
-- it under the terms of version 2 of the GNU General Public License as
-- published by the Free Software Foundation.
--
-- website-watchdog is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program; if not, write to the Free Software
-- Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

-- UP
CREATE TABLE users (id INTEGER PRIMARY KEY, first_name TEXT);
CREATE TABLE target_sites (site_url TEXT NOT NULL, response_hash TEXT);

-- DOWN
DROP TABLE users;
DROP TABLE target_sites;