-- Up Migration

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE properties (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  city        text NOT NULL DEFAULT 'Mumbai',
  address     text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            serial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'user'
                CHECK (role IN ('user', 'employee', 'admin')),
  property_id   integer REFERENCES properties(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- an employee must have a hotel; users and admins must not
  CONSTRAINT employee_needs_property
    CHECK ((role = 'employee') = (property_id IS NOT NULL))
);

CREATE TABLE refresh_tokens (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
  id          serial PRIMARY KEY,
  property_id integer NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  room_number text NOT NULL,
  type        text NOT NULL CHECK (type IN ('Standard', 'Superior', 'Deluxe', 'Suite')),
  rate_inr    numeric(12,2) NOT NULL CHECK (rate_inr > 0),
  capacity    integer NOT NULL DEFAULT 2 CHECK (capacity > 0),
  image_url   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, room_number)
);

CREATE TABLE bookings (
  id              serial PRIMARY KEY,
  room_id         integer NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  user_id         integer REFERENCES users(id) ON DELETE SET NULL,
  guest_name      text,
  check_in        date NOT NULL,
  check_out       date NOT NULL,
  amount_inr      numeric(12,2) NOT NULL CHECK (amount_inr >= 0),
  status          text NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled')),
  source_currency text NOT NULL DEFAULT 'INR' CHECK (source_currency IN ('INR', 'USD')),
  data_flag       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkout_after_checkin CHECK (check_out > check_in),
  CONSTRAINT has_guest CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL),
  -- no two active bookings may overlap for the same room
  CONSTRAINT no_overlapping_bookings
    EXCLUDE USING gist (room_id WITH =, daterange(check_in, check_out) WITH &&)
    WHERE (status <> 'cancelled')
);

CREATE TABLE reviews (
  id          serial PRIMARY KEY,
  booking_id  integer NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id integer NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  hidden      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE enquiries (
  id          serial PRIMARY KEY,
  property_id integer REFERENCES properties(id) ON DELETE SET NULL,
  name        text NOT NULL,
  email       text NOT NULL,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'answered')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rooms_property_type   ON rooms (property_id, type);
CREATE INDEX idx_bookings_room_dates   ON bookings (room_id, check_in, check_out);
CREATE INDEX idx_bookings_user         ON bookings (user_id);
CREATE INDEX idx_refresh_tokens_hash   ON refresh_tokens (token_hash);
CREATE INDEX idx_reviews_property      ON reviews (property_id);
CREATE INDEX idx_enquiries_property    ON enquiries (property_id, status);

-- Down Migration

DROP TABLE IF EXISTS enquiries;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS properties;