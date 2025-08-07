--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-0+deb12u1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-0+deb12u1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: d2s
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO d2s;

--
-- Name: dbsession; Type: TABLE; Schema: public; Owner: d2s
--

CREATE TABLE public.dbsession (
    token character varying NOT NULL,
    uid character varying NOT NULL,
    ip_address character varying NOT NULL,
    user_agent character varying NOT NULL,
    created_at timestamp without time zone NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    is_active boolean NOT NULL,
    last_activity timestamp without time zone NOT NULL
);


ALTER TABLE public.dbsession OWNER TO d2s;

--
-- Name: publicstream; Type: TABLE; Schema: public; Owner: d2s
--

CREATE TABLE public.publicstream (
    uid character varying NOT NULL,
    username character varying,
    storage_bytes integer NOT NULL,
    mtime integer NOT NULL,
    last_updated timestamp without time zone,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


ALTER TABLE public.publicstream OWNER TO d2s;

--
-- Name: uploadlog; Type: TABLE; Schema: public; Owner: d2s
--

CREATE TABLE public.uploadlog (
    id integer NOT NULL,
    uid character varying NOT NULL,
    ip character varying NOT NULL,
    filename character varying,
    processed_filename character varying,
    size_bytes integer NOT NULL,
    created_at timestamp without time zone NOT NULL
);


ALTER TABLE public.uploadlog OWNER TO d2s;

--
-- Name: uploadlog_id_seq; Type: SEQUENCE; Schema: public; Owner: d2s
--

CREATE SEQUENCE public.uploadlog_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.uploadlog_id_seq OWNER TO d2s;

--
-- Name: uploadlog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: d2s
--

ALTER SEQUENCE public.uploadlog_id_seq OWNED BY public.uploadlog.id;


--
-- Name: user; Type: TABLE; Schema: public; Owner: d2s
--

CREATE TABLE public."user" (
    token_created timestamp without time zone NOT NULL,
    email character varying NOT NULL,
    username character varying NOT NULL,
    token character varying NOT NULL,
    confirmed boolean NOT NULL,
    ip character varying NOT NULL
);


ALTER TABLE public."user" OWNER TO d2s;

--
-- Name: userquota; Type: TABLE; Schema: public; Owner: d2s
--

CREATE TABLE public.userquota (
    uid character varying NOT NULL,
    storage_bytes integer NOT NULL
);


ALTER TABLE public.userquota OWNER TO d2s;

--
-- Name: uploadlog id; Type: DEFAULT; Schema: public; Owner: d2s
--

ALTER TABLE ONLY public.uploadlog ALTER COLUMN id SET DEFAULT nextval('public.uploadlog_id_seq'::regclass);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: d2s
--

COPY public.alembic_version (version_num) FROM stdin;
\.


--
-- Data for Name: dbsession; Type: TABLE DATA; Schema: public; Owner: d2s
--

COPY public.dbsession (token, uid, ip_address, user_agent, created_at, expires_at, is_active, last_activity) FROM stdin;
6Y3PfCj-Mk3qLRttXCul8GTFZU9XWZtoHjk9I4EqnTE	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 10:32:21.725005	2025-08-07 10:32:21.724909	t	2025-08-06 10:32:21.725012
uGnwnfsAUzbNJZoqYsbT__tVxqfl4NtOD04UKYp8FEY	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 10:35:43.931018	2025-08-07 10:35:43.930918	t	2025-08-06 10:35:43.931023
OmKl-RrM8D4624xmNQigD3tdG4aXq8CzUq7Ch0qEhP4	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 10:36:02.758938	2025-08-07 10:36:02.758873	t	2025-08-06 10:36:02.758941
gGpgdAbmpwY3a-zY1Ri92l7hUEjg-GyIt1o2kIDwBE8	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 10:45:59.701084	2025-08-07 10:45:59.70098	t	2025-08-06 10:45:59.701091
GT9OKNxnhThcFXKvMBBVop7kczUH-4fE4bkCcRd17xE	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 10:46:14.181147	2025-08-07 10:46:14.181055	t	2025-08-06 10:46:14.181152
Ok0mwpRLa5Fuimt9eN0l-xUaaCmpipokTkOILSxJNuA	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 10:46:27.910441	2025-08-07 10:46:27.91036	t	2025-08-06 10:46:27.910444
DCTd4zCq_Lp_GxdwI14hFwZiDjfvNVvQrUVznllTdIA	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 10:46:35.928008	2025-08-07 10:46:35.927945	t	2025-08-06 10:46:35.928011
dtv0uti4QUudgMTnS1NRzZ9nD9vhLO1stM5bdXL4I1o	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 10:46:36.104031	2025-08-07 10:46:36.103944	t	2025-08-06 10:46:36.104034
NHZQSW6C2H-5Wq6Un6NqcAmnfSt1PqJeYJnwFKSjAss	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 10:51:33.897379	2025-08-07 10:51:33.897295	t	2025-08-06 10:51:33.897385
yYZeeLyXmwpyr8Uu1szIyyoIpLc7qiWfQwB57f4kqNI	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 10:53:43.711315	2025-08-07 10:53:43.711223	t	2025-08-06 10:53:43.71132
KhH9FO4D15l3-SUUkFHjR5Oj1N6Ld-NLmkzaM1QMhtU	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 10:56:22.050456	2025-08-07 10:56:22.050377	t	2025-08-06 10:56:22.050461
zPQqqHEY4l7ZhLrBPBnvQdsQhQj1_j0n9H6CCnIAME8	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 11:29:49.412786	2025-08-07 11:29:49.412706	t	2025-08-06 11:29:49.412792
oxYZ9qTaezYliV6UtsI62RpPClj7rIAVXK_1FB3gYMQ	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 11:34:42.099366	2025-08-07 11:34:42.099276	t	2025-08-06 11:34:42.099371
Ml6aHvae2EPXs9SWZX1BI_mNKgasjIVRMWnUSwKwixQ	oib@chello.at	127.0.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0	2025-08-06 11:38:06.002942	2025-08-07 11:38:06.002845	t	2025-08-06 11:38:06.002949
\.


--
-- Data for Name: publicstream; Type: TABLE DATA; Schema: public; Owner: d2s
--

COPY public.publicstream (uid, username, storage_bytes, mtime, last_updated, created_at, updated_at) FROM stdin;
oib@chello.at	oibchello	16151127	1754453233	2025-08-06 06:22:53.97839	2025-08-06 06:07:13.525122	2025-08-06 06:07:13.525126
\.


--
-- Data for Name: uploadlog; Type: TABLE DATA; Schema: public; Owner: d2s
--

COPY public.uploadlog (id, uid, ip, filename, processed_filename, size_bytes, created_at) FROM stdin;
111	oib@chello.at	127.0.0.1	Taös - Bobstep [ Dubstep ] [1YGV5cNJrt0].opus	210388e1-2a9b-4b7c-a72f-d4059111ee80.opus	688750	2025-08-06 06:22:53.970258
112	oib@chello.at	backfilled	107_5e6c3567-7457-48f4-83fc-f3073f065718.opus	107_5e6c3567-7457-48f4-83fc-f3073f065718.opus	671050	2025-08-06 08:14:43.312825
99	oib@chello.at	127.0.0.1	Pendulum - Set Me On Fire (Rasta Dubstep Rastep Raggastep) [ndShSlWMaeA].opus	b0afe675-de49-43eb-ab77-86e592934342.opus	1051596	2025-08-06 06:07:13.504649
100	oib@chello.at	127.0.0.1	Roots Reggae (1976) [Unreleased Album] Judah Khamani - Twelve Gates of Rebirth [94NDoPCjRL0].opus	6e0e4d7c-31a6-4d3b-ad26-1ccb8aeaaf55.opus	4751764	2025-08-06 06:08:00.96213
101	oib@chello.at	backfilled	98_15ba146a-8285-4233-9d44-e77e5fc19cd6.opus	98_15ba146a-8285-4233-9d44-e77e5fc19cd6.opus	805775	2025-08-06 08:05:27.805988
102	oib@chello.at	backfilled	97_74e975bf-22f8-4b98-8111-dbcd195a62a2.opus	97_74e975bf-22f8-4b98-8111-dbcd195a62a2.opus	775404	2025-08-06 07:57:50.570271
103	oib@chello.at	backfilled	99_b0afe675-de49-43eb-ab77-86e592934342.opus	99_b0afe675-de49-43eb-ab77-86e592934342.opus	1051596	2025-08-06 08:07:13.493002
104	oib@chello.at	backfilled	100_6e0e4d7c-31a6-4d3b-ad26-1ccb8aeaaf55.opus	100_6e0e4d7c-31a6-4d3b-ad26-1ccb8aeaaf55.opus	4751764	2025-08-06 08:08:00.944561
105	oib@chello.at	backfilled	stream.opus	stream.opus	7384026	2025-08-06 08:08:01.540555
106	oib@chello.at	127.0.0.1	Roots Reggae (1973) [Unreleased Album] Judah Khamani - Scrolls of the Fire Lion🔥 [wZvlYr5Baa8].opus	516c2ea1-6bf3-4461-91c6-e7c47e913743.opus	4760432	2025-08-06 06:14:17.072377
107	oib@chello.at	127.0.0.1	Reggae Shark Dubstep remix [101PfefUH5A].opus	5e6c3567-7457-48f4-83fc-f3073f065718.opus	671050	2025-08-06 06:14:43.326351
108	oib@chello.at	127.0.0.1	SiriuX -  RastaFari (Dubstep REMIX) [VVAWgX0IgxY].opus	25aa73c3-2a9c-4659-835d-8280a0381dc4.opus	939266	2025-08-06 06:17:55.519608
109	oib@chello.at	127.0.0.1	I'm Death, Straight Up ｜ DEATH WHISTLE (Wubbaduck x Auphinity DUBSTEP REMIX) [BK6_6RB2h64].opus	9c9b6356-d5b7-427f-9179-942593cd97e6.opus	805775	2025-08-06 06:19:41.29278
110	oib@chello.at	127.0.0.1	N.A.S.A. Way Down (feat. RZA, Barbie Hatch, & John Frusciante).mp3	72c4ce3e-c991-4fb4-b5ab-b2f83b6f616d.opus	901315	2025-08-06 06:22:01.727741
113	oib@chello.at	backfilled	110_72c4ce3e-c991-4fb4-b5ab-b2f83b6f616d.opus	110_72c4ce3e-c991-4fb4-b5ab-b2f83b6f616d.opus	901315	2025-08-06 08:22:01.71671
114	oib@chello.at	backfilled	108_25aa73c3-2a9c-4659-835d-8280a0381dc4.opus	108_25aa73c3-2a9c-4659-835d-8280a0381dc4.opus	939266	2025-08-06 08:17:55.511047
115	oib@chello.at	backfilled	106_516c2ea1-6bf3-4461-91c6-e7c47e913743.opus	106_516c2ea1-6bf3-4461-91c6-e7c47e913743.opus	4760432	2025-08-06 08:14:17.057068
116	oib@chello.at	backfilled	109_9c9b6356-d5b7-427f-9179-942593cd97e6.opus	109_9c9b6356-d5b7-427f-9179-942593cd97e6.opus	805775	2025-08-06 08:19:41.282058
117	oib@chello.at	backfilled	111_210388e1-2a9b-4b7c-a72f-d4059111ee80.opus	111_210388e1-2a9b-4b7c-a72f-d4059111ee80.opus	688750	2025-08-06 08:22:53.960209
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: d2s
--

COPY public."user" (token_created, email, username, token, confirmed, ip) FROM stdin;
2025-08-06 11:37:50.164201	oib@chello.at	oibchello	69aef338-4f18-44b2-96bb-403245901d06	t	127.0.0.1
\.


--
-- Data for Name: userquota; Type: TABLE DATA; Schema: public; Owner: d2s
--

COPY public.userquota (uid, storage_bytes) FROM stdin;
oib@chello.at	16151127
\.


--
-- Name: uploadlog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: d2s
--

SELECT pg_catalog.setval('public.uploadlog_id_seq', 117, true);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: d2s
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: dbsession dbsession_pkey; Type: CONSTRAINT; Schema: public; Owner: d2s
--

ALTER TABLE ONLY public.dbsession
    ADD CONSTRAINT dbsession_pkey PRIMARY KEY (token);


--
-- Name: publicstream publicstream_pkey; Type: CONSTRAINT; Schema: public; Owner: d2s
--

ALTER TABLE ONLY public.publicstream
    ADD CONSTRAINT publicstream_pkey PRIMARY KEY (uid);


--
-- Name: uploadlog uploadlog_pkey; Type: CONSTRAINT; Schema: public; Owner: d2s
--

ALTER TABLE ONLY public.uploadlog
    ADD CONSTRAINT uploadlog_pkey PRIMARY KEY (id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: d2s
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (email);


--
-- Name: userquota userquota_pkey; Type: CONSTRAINT; Schema: public; Owner: d2s
--

ALTER TABLE ONLY public.userquota
    ADD CONSTRAINT userquota_pkey PRIMARY KEY (uid);


--
-- Name: ix_publicstream_username; Type: INDEX; Schema: public; Owner: d2s
--

CREATE INDEX ix_publicstream_username ON public.publicstream USING btree (username);


--
-- Name: ix_user_username; Type: INDEX; Schema: public; Owner: d2s
--

CREATE UNIQUE INDEX ix_user_username ON public."user" USING btree (username);


--
-- Name: dbsession dbsession_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: d2s
--

ALTER TABLE ONLY public.dbsession
    ADD CONSTRAINT dbsession_user_id_fkey FOREIGN KEY (uid) REFERENCES public."user"(email);


--
-- PostgreSQL database dump complete
--

