--
-- PostgreSQL database dump
--


-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

-- Started on 2026-06-12 19:41:01

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 877 (class 1247 OID 41828)
-- Name: estado_amostra_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_amostra_enum AS ENUM (
    'RECOLHIDA',
    'EM_TRANSITO',
    'RECEBIDA',
    'EM_ANALISE',
    'ANALISADA',
    'DESCARTADA',
    'CONCLUIDA'
);


--
-- TOC entry 874 (class 1247 OID 41815)
-- Name: estado_descarga_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_descarga_enum AS ENUM (
    'SOLICITADA',
    'AUTORIZADA',
    'REJEITADA',
    'AGENDADA',
    'RECEBIDA',
    'CONCLUIDA'
);


--
-- TOC entry 883 (class 1247 OID 41854)
-- Name: tipo_notificacao_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_notificacao_enum AS ENUM (
    'DESCARGA',
    'AMOSTRA',
    'LABORATORIO',
    'SISTEMA'
);


--
-- TOC entry 880 (class 1247 OID 41844)
-- Name: tipo_parametro_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_parametro_enum AS ENUM (
    'FISICO_QUIMICO',
    'AZOTO',
    'METAIS',
    'OLEOS E GORDURAS',
    'TEST_TYPE_1781119441356',
    'AZOTO / NUTRIENTES',
    'METAIS PESADOS',
    'TEST_TYPE_1781124927766',
    'TEST_TYPE_1781133517107',
    'TEST_TYPE_1781134805397',
    'TEST_TYPE_1781172216869',
    'TEST_TYPE_1781172630726',
    'TEST_TYPE_1781174573998',
    'TEST_TYPE_1781188836611',
    'TEST_TYPE_1781189512985',
    'TEST_TYPE_1781189538964',
    'TEST_TYPE_1781197631771',
    'TEST_TYPE_1781219189330',
    'TEST_TYPE_1781219525184',
    'TEST_TYPE_1781220310623',
    'TEST_TYPE_1781220705292'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 232 (class 1259 OID 41980)
-- Name: amostra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amostra (
    id_amostra integer NOT NULL,
    id_descarga integer NOT NULL,
    estado_amostra public.estado_amostra_enum NOT NULL,
    data_recolha timestamp without time zone,
    data_rececao_lab timestamp without time zone,
    data_inicio_analise timestamp without time zone,
    data_fim_analise timestamp without time zone,
    data_descarte timestamp without time zone,
    data_validacao timestamp without time zone,
    id_tecnico integer,
    id_responsavel integer,
    qr_code_token text,
    boletim_publico boolean DEFAULT false,
    CONSTRAINT chk_data_analise_laboratorio CHECK (((data_inicio_analise IS NULL) OR (data_inicio_analise >= data_rececao_lab))),
    CONSTRAINT chk_data_fim_analise_inicio CHECK (((data_fim_analise IS NULL) OR (data_inicio_analise IS NULL) OR (data_fim_analise >= data_inicio_analise))),
    CONSTRAINT chk_data_rececao_lab_recolha CHECK (((data_rececao_lab IS NULL) OR (data_recolha IS NULL) OR (data_rececao_lab >= data_recolha))),
    CONSTRAINT chk_data_validacao_fim_analise CHECK (((data_validacao IS NULL) OR (data_fim_analise IS NULL) OR (data_validacao >= data_fim_analise)))
);


--
-- TOC entry 231 (class 1259 OID 41979)
-- Name: amostra_id_amostra_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.amostra_id_amostra_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5201 (class 0 OID 0)
-- Dependencies: 231
-- Name: amostra_id_amostra_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.amostra_id_amostra_seq OWNED BY public.amostra.id_amostra;


--
-- TOC entry 236 (class 1259 OID 42027)
-- Name: autorizacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autorizacao (
    id_autorizacao integer NOT NULL,
    id_cliente integer NOT NULL,
    id_etar integer NOT NULL,
    quota integer,
    ativo boolean DEFAULT true,
    auto_aprovacao boolean DEFAULT false,
    CONSTRAINT chk_quota_positiva CHECK (((quota IS NULL) OR (quota > 0)))
);


--
-- TOC entry 235 (class 1259 OID 42026)
-- Name: autorizacao_id_autorizacao_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.autorizacao_id_autorizacao_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5202 (class 0 OID 0)
-- Dependencies: 235
-- Name: autorizacao_id_autorizacao_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.autorizacao_id_autorizacao_seq OWNED BY public.autorizacao.id_autorizacao;


--
-- TOC entry 224 (class 1259 OID 41899)
-- Name: cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente (
    id_cliente integer NOT NULL,
    id_utilizador integer NOT NULL,
    nome text NOT NULL,
    morada text,
    contacto text,
    telefone text,
    email text,
    periodicidade_analise text,
    data_ultima_analise timestamp without time zone,
    CONSTRAINT chk_cliente_nome_not_empty CHECK ((TRIM(BOTH FROM nome) <> ''::text)),
    CONSTRAINT chk_periodicidade_analise CHECK (((periodicidade_analise IS NULL) OR (periodicidade_analise = ANY (ARRAY['POR_DESCARGA'::text, 'QUINZENAL'::text, 'MENSAL'::text, 'TRIMESTRAL'::text, 'SEMESTRAL'::text, 'ANUAL'::text]))))
);


--
-- TOC entry 223 (class 1259 OID 41898)
-- Name: cliente_id_cliente_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_id_cliente_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5203 (class 0 OID 0)
-- Dependencies: 223
-- Name: cliente_id_cliente_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_id_cliente_seq OWNED BY public.cliente.id_cliente;


--
-- TOC entry 241 (class 1259 OID 42374)
-- Name: cliente_parametro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_parametro (
    id_cliente integer NOT NULL,
    id_parametro integer NOT NULL,
    ativo boolean DEFAULT true
);


--
-- TOC entry 230 (class 1259 OID 41944)
-- Name: descarga; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.descarga (
    id_descarga integer NOT NULL,
    id_cliente integer NOT NULL,
    id_etar integer,
    data_pedido timestamp without time zone NOT NULL,
    tipo_efluente text NOT NULL,
    quantidade numeric,
    numero_recipientes integer,
    estado_descarga public.estado_descarga_enum NOT NULL,
    data_decisao timestamp without time zone,
    id_utilizador_decisao integer,
    data_agendamento timestamp without time zone,
    empresa_transportadora text,
    nome_produtor_externo text,
    morada_produtor_externo text,
    matricula_trator text,
    matricula_cisterna text,
    data_rececao timestamp without time zone,
    quantidade_real numeric,
    recolha_amostra boolean,
    observacoes text,
    id_utilizador_rececao integer,
    qr_code_token text,
    CONSTRAINT chk_data_agendamento_decisao CHECK (((data_agendamento IS NULL) OR (data_decisao IS NULL) OR (data_agendamento >= data_decisao))),
    CONSTRAINT chk_data_decisao_pedido CHECK (((data_decisao IS NULL) OR (data_decisao >= data_pedido))),
    CONSTRAINT chk_data_rececao_agendamento CHECK (((data_rececao IS NULL) OR (data_agendamento IS NULL) OR (data_rececao >= data_agendamento))),
    CONSTRAINT chk_numero_recipientes_positivo CHECK (((numero_recipientes IS NULL) OR (numero_recipientes > 0))),
    CONSTRAINT chk_quantidade_real_desvio CHECK (((quantidade_real IS NULL) OR ((quantidade_real >= (quantidade * 0.1)) AND (quantidade_real <= (quantidade * 2.0))))),
    CONSTRAINT descarga_quantidade_check CHECK ((quantidade > (0)::numeric)),
    CONSTRAINT descarga_quantidade_real_check CHECK ((quantidade_real > (0)::numeric))
);


--
-- TOC entry 229 (class 1259 OID 41943)
-- Name: descarga_id_descarga_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.descarga_id_descarga_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5204 (class 0 OID 0)
-- Dependencies: 229
-- Name: descarga_id_descarga_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.descarga_id_descarga_seq OWNED BY public.descarga.id_descarga;


--
-- TOC entry 226 (class 1259 OID 41918)
-- Name: etar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etar (
    id_etar integer NOT NULL,
    nome text NOT NULL,
    localizacao text,
    disponivel boolean DEFAULT true,
    CONSTRAINT chk_etar_nome_not_empty CHECK ((TRIM(BOTH FROM nome) <> ''::text))
);


--
-- TOC entry 225 (class 1259 OID 41917)
-- Name: etar_id_etar_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.etar_id_etar_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5205 (class 0 OID 0)
-- Dependencies: 225
-- Name: etar_id_etar_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.etar_id_etar_seq OWNED BY public.etar.id_etar;


--
-- TOC entry 238 (class 1259 OID 42051)
-- Name: historico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historico (
    id_historico integer NOT NULL,
    entidade text NOT NULL,
    id_entidade integer NOT NULL,
    acao text NOT NULL,
    descricao text,
    data timestamp without time zone DEFAULT now(),
    id_utilizador integer NOT NULL,
    CONSTRAINT chk_entidade_valida CHECK ((entidade = ANY (ARRAY['DESCARGA'::text, 'AMOSTRA'::text, 'PARAMETRO'::text, 'AUTORIZACAO'::text, 'ETAR'::text, 'PERFIL'::text, 'SISTEMA'::text, 'UTILIZADOR'::text, 'CLIENTE'::text])))
);


--
-- TOC entry 237 (class 1259 OID 42050)
-- Name: historico_id_historico_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.historico_id_historico_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5206 (class 0 OID 0)
-- Dependencies: 237
-- Name: historico_id_historico_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.historico_id_historico_seq OWNED BY public.historico.id_historico;


--
-- TOC entry 240 (class 1259 OID 42071)
-- Name: notificacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificacao (
    id_notificacao integer NOT NULL,
    id_utilizador integer NOT NULL,
    mensagem text NOT NULL,
    tipo public.tipo_notificacao_enum,
    enviada boolean DEFAULT false,
    lida boolean DEFAULT false,
    data timestamp without time zone DEFAULT now(),
    CONSTRAINT chk_lida_enviada CHECK (((enviada = true) OR (lida = false))),
    CONSTRAINT chk_mensagem_not_empty CHECK ((TRIM(BOTH FROM mensagem) <> ''::text))
);


--
-- TOC entry 239 (class 1259 OID 42070)
-- Name: notificacao_id_notificacao_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notificacao_id_notificacao_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5207 (class 0 OID 0)
-- Dependencies: 239
-- Name: notificacao_id_notificacao_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notificacao_id_notificacao_seq OWNED BY public.notificacao.id_notificacao;


--
-- TOC entry 228 (class 1259 OID 41930)
-- Name: parametro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parametro (
    id_parametro integer NOT NULL,
    nome text NOT NULL,
    tipo_parametro public.tipo_parametro_enum NOT NULL,
    unidade_default text,
    obrigatorio boolean DEFAULT false,
    metodo_default_cod text,
    metodo_default_nome text,
    incerteza_default numeric,
    CONSTRAINT parametro_incerteza_default_check CHECK ((incerteza_default >= (0)::numeric))
);


--
-- TOC entry 227 (class 1259 OID 41929)
-- Name: parametro_id_parametro_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.parametro_id_parametro_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5208 (class 0 OID 0)
-- Dependencies: 227
-- Name: parametro_id_parametro_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.parametro_id_parametro_seq OWNED BY public.parametro.id_parametro;


--
-- TOC entry 220 (class 1259 OID 41864)
-- Name: perfil; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.perfil (
    id_perfil integer NOT NULL,
    nome text NOT NULL
);


--
-- TOC entry 219 (class 1259 OID 41863)
-- Name: perfil_id_perfil_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.perfil_id_perfil_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5209 (class 0 OID 0)
-- Dependencies: 219
-- Name: perfil_id_perfil_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.perfil_id_perfil_seq OWNED BY public.perfil.id_perfil;


--
-- TOC entry 234 (class 1259 OID 42005)
-- Name: resultado_analitico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resultado_analitico (
    id_resultado integer NOT NULL,
    id_amostra integer NOT NULL,
    id_parametro integer NOT NULL,
    valor numeric,
    unidade text,
    metodo text,
    incerteza numeric,
    CONSTRAINT chk_incerteza_positiva CHECK (((incerteza IS NULL) OR (incerteza >= (0)::numeric))),
    CONSTRAINT chk_valor_positivo CHECK (((valor IS NULL) OR (valor >= (0)::numeric)))
);


--
-- TOC entry 233 (class 1259 OID 42004)
-- Name: resultado_analitico_id_resultado_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.resultado_analitico_id_resultado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5210 (class 0 OID 0)
-- Dependencies: 233
-- Name: resultado_analitico_id_resultado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.resultado_analitico_id_resultado_seq OWNED BY public.resultado_analitico.id_resultado;


--
-- TOC entry 222 (class 1259 OID 41877)
-- Name: utilizador; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.utilizador (
    id_utilizador integer NOT NULL,
    id_perfil integer NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    ativo boolean DEFAULT true,
    id_etar integer,
    CONSTRAINT chk_email_formato CHECK ((email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)),
    CONSTRAINT chk_utilizador_nome_not_empty CHECK ((TRIM(BOTH FROM nome) <> ''::text))
);


--
-- TOC entry 221 (class 1259 OID 41876)
-- Name: utilizador_id_utilizador_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.utilizador_id_utilizador_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5211 (class 0 OID 0)
-- Dependencies: 221
-- Name: utilizador_id_utilizador_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.utilizador_id_utilizador_seq OWNED BY public.utilizador.id_utilizador;


--
-- TOC entry 4931 (class 2604 OID 41983)
-- Name: amostra id_amostra; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amostra ALTER COLUMN id_amostra SET DEFAULT nextval('public.amostra_id_amostra_seq'::regclass);


--
-- TOC entry 4934 (class 2604 OID 42030)
-- Name: autorizacao id_autorizacao; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizacao ALTER COLUMN id_autorizacao SET DEFAULT nextval('public.autorizacao_id_autorizacao_seq'::regclass);


--
-- TOC entry 4925 (class 2604 OID 41902)
-- Name: cliente id_cliente; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente ALTER COLUMN id_cliente SET DEFAULT nextval('public.cliente_id_cliente_seq'::regclass);


--
-- TOC entry 4930 (class 2604 OID 41947)
-- Name: descarga id_descarga; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descarga ALTER COLUMN id_descarga SET DEFAULT nextval('public.descarga_id_descarga_seq'::regclass);


--
-- TOC entry 4926 (class 2604 OID 41921)
-- Name: etar id_etar; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etar ALTER COLUMN id_etar SET DEFAULT nextval('public.etar_id_etar_seq'::regclass);


--
-- TOC entry 4937 (class 2604 OID 42054)
-- Name: historico id_historico; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico ALTER COLUMN id_historico SET DEFAULT nextval('public.historico_id_historico_seq'::regclass);


--
-- TOC entry 4939 (class 2604 OID 42074)
-- Name: notificacao id_notificacao; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacao ALTER COLUMN id_notificacao SET DEFAULT nextval('public.notificacao_id_notificacao_seq'::regclass);


--
-- TOC entry 4928 (class 2604 OID 41933)
-- Name: parametro id_parametro; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametro ALTER COLUMN id_parametro SET DEFAULT nextval('public.parametro_id_parametro_seq'::regclass);


--
-- TOC entry 4922 (class 2604 OID 41867)
-- Name: perfil id_perfil; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfil ALTER COLUMN id_perfil SET DEFAULT nextval('public.perfil_id_perfil_seq'::regclass);


--
-- TOC entry 4933 (class 2604 OID 42008)
-- Name: resultado_analitico id_resultado; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultado_analitico ALTER COLUMN id_resultado SET DEFAULT nextval('public.resultado_analitico_id_resultado_seq'::regclass);


--
-- TOC entry 4923 (class 2604 OID 41880)
-- Name: utilizador id_utilizador; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilizador ALTER COLUMN id_utilizador SET DEFAULT nextval('public.utilizador_id_utilizador_seq'::regclass);


--
-- TOC entry 5186 (class 0 OID 41980)
-- Dependencies: 232
-- Data for Name: amostra; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.amostra (id_amostra, id_descarga, estado_amostra, data_recolha, data_rececao_lab, data_inicio_analise, data_fim_analise, data_descarte, data_validacao, id_tecnico, id_responsavel, qr_code_token, boletim_publico) FROM stdin;
28	2	RECOLHIDA	2026-06-08 15:59:28.920728	\N	\N	\N	\N	\N	\N	\N	AMOSTRA-2026-7CA864	f
44	1	CONCLUIDA	2026-06-08 18:44:09.196369	2026-06-08 18:45:24.118393	2026-06-08 18:45:24.118393	2026-06-10 19:30:40.40571	\N	2026-06-11 12:39:00.04352	7	8	AMOSTRA-2026-9DF686	f
29	3	CONCLUIDA	2026-06-08 16:02:27.008393	2026-06-08 16:03:51.446094	2026-06-08 16:03:51.446094	2026-06-08 16:10:51.286079	\N	2026-06-08 16:11:27.306714	7	8	AMOSTRA-2026-18DA0C	t
49	82	CONCLUIDA	2026-06-08 19:22:01.324165	2026-06-08 19:42:48.284807	2026-06-08 19:42:48.284807	2026-06-08 19:45:36.322648	\N	2026-06-08 19:46:21.250988	7	8	AMOSTRA-2026-D143BD	t
1	4	CONCLUIDA	2026-06-06 22:45:25.59788	2026-06-06 22:45:25.59788	2026-06-07 22:45:25.59788	2026-06-08 05:31:08.000111	\N	2026-06-08 05:31:56.190933	7	8	AMOSTRA-2026-BBB99F	t
2	6	CONCLUIDA	2026-06-08 02:04:53.709569	2026-06-08 19:33:38.735237	2026-06-08 19:33:38.735237	2026-06-10 06:15:16.541096	\N	2026-06-10 19:32:06.038954	7	8	AMOSTRA-2026-AC8AB6	f
\.


--
-- TOC entry 5190 (class 0 OID 42027)
-- Dependencies: 236
-- Data for Name: autorizacao; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.autorizacao (id_autorizacao, id_cliente, id_etar, quota, ativo, auto_aprovacao) FROM stdin;
2	2	2	3	t	f
4	3	2	1	t	t
3	3	1	2	f	t
12	11	2	1	t	t
1	1	1	5	t	t
\.


--
-- TOC entry 5178 (class 0 OID 41899)
-- Dependencies: 224
-- Data for Name: cliente; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cliente (id_cliente, id_utilizador, nome, morada, contacto, telefone, email, periodicidade_analise, data_ultima_analise) FROM stdin;
11	18	EmpresaIndustrialCCC	Travessa das fontainhas, 102	Nuno Fonseca	966666666	mariana.Abreu@administracao.pt	QUINZENAL	\N
2	2	EmpresaIndustrialBBB SA	Parque Industrial de Coimbra, Pavilhão 3	Marta Lima	922222222	geral@empresaindustrialbbb.pt	TRIMESTRAL	2026-06-06 22:45:25.597
1	1	EmpresaIndustrialAAA SA	Zona Industrial da Maia, Lote 5	Rui Santos	911111111	geral@empresaindustrialaaa.pt	MENSAL	\N
3	3	TransEfluentes Lda	Sede Logística - Viseu	Jorge Duarte	933333333	logistica@transefluentes.pt	POR_DESCARGA	2026-06-08 19:22:01.324
\.


--
-- TOC entry 5195 (class 0 OID 42374)
-- Dependencies: 241
-- Data for Name: cliente_parametro; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cliente_parametro (id_cliente, id_parametro, ativo) FROM stdin;
1	6	t
2	6	t
2	7	t
\.


--
-- TOC entry 5184 (class 0 OID 41944)
-- Dependencies: 230
-- Data for Name: descarga; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.descarga (id_descarga, id_cliente, id_etar, data_pedido, tipo_efluente, quantidade, numero_recipientes, estado_descarga, data_decisao, id_utilizador_decisao, data_agendamento, empresa_transportadora, nome_produtor_externo, morada_produtor_externo, matricula_trator, matricula_cisterna, data_rececao, quantidade_real, recolha_amostra, observacoes, id_utilizador_rececao, qr_code_token) FROM stdin;
22	1	1	2026-06-08 04:32:50.351	Domestico	1500	1	CONCLUIDA	2026-06-10 01:03:05.483	9	2026-06-11 11:53:54.028584	Viatura própria	\N	\N	BB-66-CC	\N	2026-06-11 11:55:56.55055	1500	f	\N	4	DESC-2026-90B9AC
1	1	1	2026-06-06 22:45:25.59788	Domestico	100	2	CONCLUIDA	2026-06-08 15:29:52.349198	9	2026-06-08 15:32:31.120299	Transporte próprio	\N	\N	11-AB-22	\N	2026-06-08 18:44:09.196369	100	t	\N	4	DESC-2026-91FEA5
7	1	2	2026-06-08 02:04:53.511	Domestico	300	\N	AGENDADA	2026-06-08 02:04:53.605216	9	2026-06-08 23:18:21.317249	Transporte próprio	\N	\N	SS-09-OP	\N	\N	\N	\N	[ALERTA OPERACIONAL: ETAR indisponível. Contactar o cliente imediatamente se a descarga não puder ser realizada (ex: impossibilidade de usar o tanque de retenção).]\nAprovado pelo gestor de plantão.	\N	DESC-2026-3B5E14
26	1	1	2026-06-08 04:39:45.41	Domestico	15000	1	REJEITADA	2026-06-08 04:39:45.41	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Cancelada pelo cliente	\N	\N
27	1	2	2026-06-08 04:41:00.57	Industrial	15000	1	REJEITADA	2026-06-08 04:41:56.365983	9	\N	\N	\N	\N	\N	\N	\N	\N	\N	volume muito elevado.	\N	\N
4	2	1	2026-06-03 22:45:25.59788	Domestico	150	\N	CONCLUIDA	2026-06-04 22:45:25.59788	6	2026-06-05 22:45:25.59788	Transportes Y	\N	\N	IT-45_LL	\N	2026-06-06 22:45:25.59788	145	t	\N	5	\N
71	3	1	2026-06-08 18:27:53.863	Industrial	5000	1	SOLICITADA	\N	\N	\N	\N	CAPITALMOVEL, Fabrica de Moveis	Zona Industrial Paços de Ferreira	\N	\N	\N	\N	\N	Carateristicas e proveniência do efluente a descarregar.	\N	\N
2	1	1	2026-06-05 22:45:25.59788	Industrial	200	\N	RECEBIDA	2026-06-06 22:45:25.59788	6	2026-06-08 15:12:22.726446	Transporte próprio	\N	\N	QQ-01-YY	\N	2026-06-08 15:59:28.920728	200	t	\N	4	DESC-2026-F824F4
3	1	1	2026-06-04 22:45:25.59788	Industrial	300	\N	CONCLUIDA	2026-06-05 22:45:25.59788	6	2026-06-06 22:45:25.59788	Transportes X	\N	\N	AA-00-AA	BB-00-BB	2026-06-08 16:02:27.008393	300	t	\N	4	\N
168	11	2	2026-06-09 18:59:14.324	Domestico	2000	1	SOLICITADA	2026-06-09 18:59:14.324	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[Revertido por indisponibilidade urgente da ETAR Centro].\nNão foi encontrada alternativa viável automaticamente.\nAguarde reencaminhamento por parte da Gestão de Clientes.	\N	\N
82	3	2	2026-06-08 19:18:06.393	Industrial	1000	\N	CONCLUIDA	2026-06-08 19:18:06.393	\N	2026-06-08 19:20:04.821247	TransEfluentes, Lda	ABC, Supermercados	Zona Industrial Porto	XZ-99-SD	21-EE-12	2026-06-08 19:22:01.324165	1000	t	\N	5	DESC-2026-298144
292	11	3	2026-06-10 00:44:58.459	Industrial	1000	1	AUTORIZADA	2026-06-11 11:48:49.831247	120	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
6	1	1	2026-06-08 02:04:53.496	Industrial	500	1	CONCLUIDA	2026-06-08 02:04:53.496	\N	2026-06-08 02:04:53.613925	TransEfluentes Lda	\N	\N	AA-11-BB	CC-22-DD	2026-06-08 02:04:53.709569	480	t	Volume ligeiramente menor. Amostra colhida para o frasco.	4	DESC-2026-6770F2
849	1	3	2026-06-11 11:51:23.442	Domestico	2500	1	AUTORIZADA	2026-06-12 01:29:33.440099	120	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- TOC entry 5180 (class 0 OID 41918)
-- Dependencies: 226
-- Data for Name: etar; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.etar (id_etar, nome, localizacao, disponivel) FROM stdin;
1	ETAR Norte	Porto	t
3	ETAR Sul	Lisboa	t
2	ETAR Centro	Coimbra	f
4	ETAR Algarve	Faro	t
\.


--
-- TOC entry 5192 (class 0 OID 42051)
-- Dependencies: 238
-- Data for Name: historico; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.historico (id_historico, entidade, id_entidade, acao, descricao, data, id_utilizador) FROM stdin;
1	DESCARGA	2	AUTORIZACAO	Descarga autorizada pelo gestor	2026-06-07 23:26:07.981719	9
2	DESCARGA	3	AGENDAMENTO	Descarga agendada pelo cliente	2026-06-07 23:26:07.981719	1
3	DESCARGA	4	RECECAO	Receção realizada pelo operador	2026-06-07 23:26:07.981719	4
4	DESCARGA	6	CRIACAO	Pedido criado e aprovado automaticamente pelo sistema (Whitelist/Quota).	2026-06-08 02:04:53.504042	1
5	DESCARGA	7	CRIACAO	Pedido criado. A aguardar aprovação manual.	2026-06-08 02:04:53.513664	1
6	DESCARGA	7	AUTORIZACAO	Pedido de descarga analisado e autorizada manualmente. Obs: Aprovado pelo gestor de plantão.	2026-06-08 02:04:53.607365	9
7	DESCARGA	6	AGENDAMENTO	Descarga agendada: TransEfluentes Lda | Trator: AA-11-BB | Cisterna: CC-22-DD	2026-06-08 02:04:53.615109	1
8	DESCARGA	6	RECECAO	Descarga recebida na ETAR. Vol Real: 480L | Amostra Recolhida: SIM	2026-06-08 02:04:53.709569	4
130	DESCARGA	2	AGENDAMENTO	Descarga agendada: Transporte próprio | Trator: QQ-01-YY | Cisterna: N/A	2026-06-08 15:12:22.740331	1
131	DESCARGA	1	AUTORIZACAO	Pedido de descarga analisado e autorizada manualmente. Obs: Sem observações	2026-06-08 15:29:52.354334	9
132	DESCARGA	1	AGENDAMENTO	Descarga agendada: Transporte próprio | Trator: 11-AB-22 | Cisterna: N/A	2026-06-08 15:32:31.122568	1
133	DESCARGA	2	RECECAO	Descarga recebida na ETAR. Vol Real: 200L | Amostra Recolhida: SIM	2026-06-08 15:59:28.920728	4
134	DESCARGA	3	RECECAO	Descarga recebida na ETAR. Vol Real: 300L | Amostra Recolhida: SIM	2026-06-08 16:02:27.008393	4
135	AMOSTRA	29	RECEPCAO	Amostra recebida no laboratório. Triagem: ANALISAR (periodicidade contratada fora de prazo ou primeira análise).	2026-06-08 16:03:51.446094	7
136	AMOSTRA	29	RESULTADOS	Resultados laboratoriais inseridos com sucesso na bancada.	2026-06-08 16:10:51.286079	7
137	AMOSTRA	29	VALIDACAO	Análise laboratorial validada e concluída pelo responsável.	2026-06-08 16:11:27.306714	8
138	DESCARGA	3	CONCLUSAO	Descarga finalizada e concluída após validação do Boletim Analítico.	2026-06-08 16:11:27.306714	8
470	DESCARGA	168	CRIACAO	Pedido criado e aprovado automaticamente pelo sistema (Whitelist/Quota).	2026-06-09 18:59:14.339061	18
659	DESCARGA	26	CANCELAMENTO	Descarga cancelada pelo cliente.	2026-06-09 20:38:41.554785	1
1363	AMOSTRA	2	RESULTADOS	Resultados laboratoriais inseridos com sucesso na bancada.	2026-06-10 06:15:16.541096	7
1575	AMOSTRA	44	RESULTADOS	Resultados laboratoriais inseridos com sucesso na bancada.	2026-06-10 19:30:40.40571	142
1798	PARAMETRO	26	EDICAO	Parâmetro Hidrocarbonetos atualizado no catálogo. Nome: Hidrocarbonetos, Tipo: OLEOS E GORDURAS, Obrigatório: Não.	2026-06-10 20:35:20.585156	8
1883	CLIENTE	138	CRIACAO	Cliente contratado Empresa Teste CRUD Lda registado no sistema.	2026-06-11 00:40:03.010437	9
1884	CLIENTE	138	ALTERACAO_STATUS	Estado da conta do cliente id #138 atualizado para inativo.	2026-06-11 00:40:03.412578	9
1885	CLIENTE	138	ALTERACAO_STATUS	Estado da conta do cliente id #138 atualizado para ativo.	2026-06-11 00:40:03.429852	9
1886	CLIENTE	138	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 00:40:03.44844	9
91	AMOSTRA	1	RESULTADOS	Resultados laboratoriais inseridos com sucesso na bancada.	2026-06-08 05:31:08.000111	7
92	AMOSTRA	1	VALIDACAO	Análise laboratorial validada e concluída pelo responsável.	2026-06-08 05:31:56.190933	8
93	DESCARGA	4	CONCLUSAO	Descarga finalizada e concluída após validação do Boletim Analítico.	2026-06-08 05:31:56.190933	8
1975	CLIENTE	142	CRIACAO	Cliente contratado Empresa Teste CRUD Lda registado no sistema.	2026-06-11 11:10:28.228876	9
1888	AUTORIZACAO	273	CRIACAO	Regra de whitelist criada para cliente #138 na ETAR #2 com quota de 7 descargas/dia.	2026-06-11 00:40:03.622836	9
210	DESCARGA	71	CRIACAO	Pedido criado. A aguardar aprovação manual.	2026-06-08 18:27:53.878438	3
211	DESCARGA	71	PEDIDO_ELEMENTOS	Foram solicitados elementos adicionais ao cliente. Obs: Carateristicas e proveniência do efluente a descarregar.	2026-06-08 18:29:23.362791	9
212	DESCARGA	1	RECECAO	Descarga recebida na ETAR. Vol Real: 100L | Amostra Recolhida: SIM	2026-06-08 18:44:09.196369	4
213	AMOSTRA	44	RECEPCAO	Amostra recebida no laboratório. Triagem: ANALISAR (periodicidade contratada fora de prazo ou primeira análise).	2026-06-08 18:45:24.118393	7
1889	AUTORIZACAO	274	CRIACAO	Regra de whitelist criada para cliente #138 na ETAR #3 com quota de Sem limite.	2026-06-11 00:40:03.641421	9
1890	AUTORIZACAO	273	EDICAO	Regra de whitelist id #273 atualizada. Quota: Sem limite, Auto-Aprovação: Sim, Ativa: Sim.	2026-06-11 00:40:03.660494	9
352	DESCARGA	7	AGENDAMENTO	Descarga agendada: Transporte próprio | Trator: SS-09-OP | Cisterna: N/A	2026-06-08 23:18:21.321386	1
1891	CLIENTE	138	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 00:40:03.725127	9
158	AMOSTRA	29	DISPONIBILIZAR	Boletim analítico disponibilizado para o cliente pela gestão.	2026-06-08 17:13:28.726416	9
1892	UTILIZADOR	212	CRIACAO	Utilizador interno Técnico de Teste CRUD (tecnico.crud@laboratorio.pt) criado com perfil id #4.	2026-06-11 00:40:04.758464	120
50	DESCARGA	22	CRIACAO	Pedido criado. A aguardar aprovação manual.	2026-06-08 04:32:50.359623	1
51	DESCARGA	22	REJEICAO	Pedido de descarga analisado e rejeitada manualmente. Obs: Volume muito elevado.	2026-06-08 04:33:59.521361	9
61	DESCARGA	26	CRIACAO	Pedido criado e aprovado automaticamente pelo sistema (Whitelist/Quota).	2026-06-08 04:39:45.417374	1
62	DESCARGA	27	CRIACAO	Pedido criado. A aguardar aprovação manual.	2026-06-08 04:41:00.577265	1
63	DESCARGA	27	REJEICAO	Pedido de descarga analisado e rejeitada manualmente. Obs: volume muito elevado.	2026-06-08 04:41:56.369772	9
240	DESCARGA	82	CRIACAO	Pedido criado e aprovado automaticamente pelo sistema (Whitelist/Quota).	2026-06-08 19:18:06.401266	3
241	DESCARGA	82	AGENDAMENTO	Descarga agendada: TransEfluentes, Lda | Trator: XZ-99-SD | Cisterna: 21-EE-12	2026-06-08 19:20:04.834745	3
242	DESCARGA	82	RECECAO	Descarga recebida na ETAR. Vol Real: 1000L | Amostra Recolhida: SIM	2026-06-08 19:22:01.324165	5
243	AMOSTRA	2	RECEPCAO	Amostra recebida no laboratório. Triagem: ANALISAR (periodicidade contratada fora de prazo ou primeira análise).	2026-06-08 19:33:38.735237	7
257	AMOSTRA	49	RECEPCAO	Amostra recebida no laboratório. Triagem: ANALISAR (periodicidade contratada fora de prazo ou primeira análise).	2026-06-08 19:42:48.284807	7
258	AMOSTRA	49	RESULTADOS	Resultados laboratoriais inseridos com sucesso na bancada.	2026-06-08 19:45:36.322648	7
259	AMOSTRA	49	VALIDACAO	Análise laboratorial validada e concluída pelo responsável.	2026-06-08 19:46:21.250988	8
260	DESCARGA	82	CONCLUSAO	Descarga finalizada e concluída após validação do Boletim Analítico.	2026-06-08 19:46:21.250988	8
1576	AMOSTRA	2	RESULTADOS	Resultados laboratoriais inseridos com sucesso na bancada.	2026-06-10 19:32:06.002225	8
1577	AMOSTRA	2	VALIDACAO	Análise laboratorial validada e concluída pelo responsável.	2026-06-10 19:32:06.038954	8
1578	DESCARGA	6	CONCLUSAO	Descarga finalizada e concluída após validação do Boletim Analítico.	2026-06-10 19:32:06.038954	8
740	DESCARGA	292	CRIACAO	Pedido criado. A aguardar aprovação manual.	2026-06-10 00:44:58.488446	18
1893	UTILIZADOR	212	EDICAO	Utilizador interno Técnico de Teste Editado atualizado (palavra-passe alterada). Ativo: Não.	2026-06-11 00:40:05.09157	120
1976	CLIENTE	142	ALTERACAO_STATUS	Estado da conta do cliente id #142 atualizado para inativo.	2026-06-11 11:10:28.629375	9
1977	CLIENTE	142	ALTERACAO_STATUS	Estado da conta do cliente id #142 atualizado para ativo.	2026-06-11 11:10:28.647384	9
1978	CLIENTE	142	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 11:10:28.666917	9
2069	DESCARGA	292	AUTORIZACAO	Pedido de descarga analisado e autorizada manualmente. Obs: Sem observações	2026-06-11 11:48:49.83514	120
1980	AUTORIZACAO	283	CRIACAO	Regra de whitelist criada para cliente #142 na ETAR #2 com quota de 7 descargas/dia.	2026-06-11 11:10:28.867152	9
1981	AUTORIZACAO	284	CRIACAO	Regra de whitelist criada para cliente #142 na ETAR #3 com quota de Sem limite.	2026-06-11 11:10:28.887084	9
1982	AUTORIZACAO	283	EDICAO	Regra de whitelist id #283 atualizada. Quota: Sem limite, Auto-Aprovação: Sim, Ativa: Sim.	2026-06-11 11:10:28.907135	9
1983	CLIENTE	142	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 11:10:28.98036	9
1984	UTILIZADOR	218	CRIACAO	Utilizador interno Técnico de Teste CRUD (tecnico.crud@laboratorio.pt) criado com perfil id #4.	2026-06-11 11:10:30.030322	120
1985	UTILIZADOR	218	EDICAO	Utilizador interno Técnico de Teste Editado atualizado (palavra-passe alterada). Ativo: Não.	2026-06-11 11:10:30.369451	120
2071	DESCARGA	22	AGENDAMENTO	Descarga agendada: Viatura própria | Trator: BB-66-CC | Cisterna: N/A	2026-06-11 11:53:54.031182	1
2073	AMOSTRA	44	RESULTADOS	Resultados laboratoriais inseridos com sucesso na bancada.	2026-06-11 12:39:00.007924	8
2074	AMOSTRA	44	VALIDACAO	Análise laboratorial validada e concluída pelo responsável.	2026-06-11 12:39:00.04352	8
2075	DESCARGA	1	CONCLUSAO	Descarga finalizada e concluída após validação do Boletim Analítico.	2026-06-11 12:39:00.04352	8
2081	AMOSTRA	49	DISPONIBILIZAR	Boletim analítico disponibilizado para o cliente pela gestão.	2026-06-11 15:11:02.945452	120
2083	CLIENTE	146	CRIACAO	Cliente contratado Empresa Teste CRUD Lda registado no sistema.	2026-06-11 15:40:33.920012	9
2084	CLIENTE	146	ALTERACAO_STATUS	Estado da conta do cliente id #146 atualizado para inativo.	2026-06-11 15:40:34.348681	9
2085	CLIENTE	146	ALTERACAO_STATUS	Estado da conta do cliente id #146 atualizado para ativo.	2026-06-11 15:40:34.367839	9
2086	CLIENTE	146	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 15:40:34.390301	9
2087	AUTORIZACAO	293	CRIACAO	Regra de whitelist criada para cliente #146 na ETAR #2 com quota de 7 descargas/dia.	2026-06-11 15:40:34.592807	9
2088	AUTORIZACAO	294	CRIACAO	Regra de whitelist criada para cliente #146 na ETAR #3 com quota de Sem limite.	2026-06-11 15:40:34.612627	9
1615	PARAMETRO	26	CRIACAO	Parâmetro analítico global Hidrocarbonetos (OLEOS E GORDURAS) criado no catálogo do sistema.	2026-06-10 20:00:57.739986	120
2089	AUTORIZACAO	293	EDICAO	Regra de whitelist id #293 atualizada. Quota: Sem limite, Auto-Aprovação: Sim, Ativa: Sim.	2026-06-11 15:40:34.632694	9
2090	CLIENTE	146	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 15:40:34.706292	9
766	DESCARGA	22	EDICAO	Pedido reeditado pelo cliente e aprovado automaticamente (Whitelist/Quota).	2026-06-10 01:03:05.49426	1
2091	UTILIZADOR	224	CRIACAO	Utilizador interno Técnico de Teste CRUD (tecnico.crud@laboratorio.pt) criado com perfil id #4.	2026-06-11 15:40:35.923501	120
2092	UTILIZADOR	224	EDICAO	Utilizador interno Técnico de Teste Editado atualizado (palavra-passe alterada). Ativo: Não.	2026-06-11 15:40:36.26996	120
2224	CLIENTE	152	CRIACAO	Cliente contratado Empresa Teste CRUD Lda registado no sistema.	2026-06-11 18:07:09.17022	9
1836	CLIENTE	136	CRIACAO	Cliente contratado Empresa Teste CRUD Lda registado no sistema.	2026-06-11 00:18:34.669109	9
1837	CLIENTE	136	ALTERACAO_STATUS	Estado da conta do cliente id #136 atualizado para inativo.	2026-06-11 00:18:35.07445	9
1838	CLIENTE	136	ALTERACAO_STATUS	Estado da conta do cliente id #136 atualizado para ativo.	2026-06-11 00:18:35.090873	9
1839	CLIENTE	136	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 00:18:35.109675	9
2225	CLIENTE	152	ALTERACAO_STATUS	Estado da conta do cliente id #152 atualizado para inativo.	2026-06-11 18:07:09.607248	9
1841	AUTORIZACAO	268	CRIACAO	Regra de whitelist criada para cliente #136 na ETAR #2 com quota de 7 descargas/dia.	2026-06-11 00:18:35.285214	9
1842	AUTORIZACAO	269	CRIACAO	Regra de whitelist criada para cliente #136 na ETAR #3 com quota de Sem limite.	2026-06-11 00:18:35.303758	9
1843	AUTORIZACAO	268	EDICAO	Regra de whitelist id #268 atualizada. Quota: Sem limite, Auto-Aprovação: Sim, Ativa: Sim.	2026-06-11 00:18:35.32276	9
1844	CLIENTE	136	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 00:18:35.393523	9
1845	UTILIZADOR	209	CRIACAO	Utilizador interno Técnico de Teste CRUD (tecnico.crud@laboratorio.pt) criado com perfil id #4.	2026-06-11 00:18:36.436958	120
1846	UTILIZADOR	209	EDICAO	Utilizador interno Técnico de Teste Editado atualizado (palavra-passe alterada). Ativo: Não.	2026-06-11 00:18:36.781723	120
2226	CLIENTE	152	ALTERACAO_STATUS	Estado da conta do cliente id #152 atualizado para ativo.	2026-06-11 18:07:09.626597	9
2227	CLIENTE	152	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 18:07:09.644436	9
1930	CLIENTE	140	CRIACAO	Cliente contratado Empresa Teste CRUD Lda registado no sistema.	2026-06-11 11:03:32.08993	9
1931	CLIENTE	140	ALTERACAO_STATUS	Estado da conta do cliente id #140 atualizado para inativo.	2026-06-11 11:03:32.593334	9
1932	CLIENTE	140	ALTERACAO_STATUS	Estado da conta do cliente id #140 atualizado para ativo.	2026-06-11 11:03:32.618504	9
1934	AUTORIZACAO	278	CRIACAO	Regra de whitelist criada para cliente #140 na ETAR #2 com quota de 7 descargas/dia.	2026-06-11 11:03:35.119712	9
1935	AUTORIZACAO	279	CRIACAO	Regra de whitelist criada para cliente #140 na ETAR #3 com quota de Sem limite.	2026-06-11 11:03:35.142125	9
1936	AUTORIZACAO	278	EDICAO	Regra de whitelist id #278 atualizada. Quota: Sem limite, Auto-Aprovação: Sim, Ativa: Sim.	2026-06-11 11:03:35.161019	9
1937	UTILIZADOR	215	CRIACAO	Utilizador interno Técnico de Teste CRUD (tecnico.crud@laboratorio.pt) criado com perfil id #4.	2026-06-11 11:03:36.015135	120
1938	UTILIZADOR	215	EDICAO	Utilizador interno Técnico de Teste Editado atualizado (palavra-passe alterada). Ativo: Não.	2026-06-11 11:03:36.377376	120
2070	DESCARGA	849	CRIACAO	Pedido criado. A aguardar aprovação manual.	2026-06-11 11:51:23.457986	1
2072	DESCARGA	22	RECECAO	Descarga recebida na ETAR. Vol Real: 1500L | Amostra Recolhida: NÃO	2026-06-11 11:55:56.55055	4
2228	AUTORIZACAO	308	CRIACAO	Regra de whitelist criada para cliente #152 na ETAR #2 com quota de 7 descargas/dia.	2026-06-11 18:07:09.855023	9
2022	CLIENTE	144	CRIACAO	Cliente contratado Empresa Teste CRUD Lda registado no sistema.	2026-06-11 11:42:51.516898	9
2023	CLIENTE	144	ALTERACAO_STATUS	Estado da conta do cliente id #144 atualizado para inativo.	2026-06-11 11:42:51.916514	9
2024	CLIENTE	144	ALTERACAO_STATUS	Estado da conta do cliente id #144 atualizado para ativo.	2026-06-11 11:42:51.933341	9
2025	CLIENTE	144	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 11:42:51.952176	9
2229	AUTORIZACAO	309	CRIACAO	Regra de whitelist criada para cliente #152 na ETAR #3 com quota de Sem limite.	2026-06-11 18:07:09.878802	9
2027	AUTORIZACAO	288	CRIACAO	Regra de whitelist criada para cliente #144 na ETAR #2 com quota de 7 descargas/dia.	2026-06-11 11:42:52.143825	9
2028	AUTORIZACAO	289	CRIACAO	Regra de whitelist criada para cliente #144 na ETAR #3 com quota de Sem limite.	2026-06-11 11:42:52.182146	9
2029	AUTORIZACAO	288	EDICAO	Regra de whitelist id #288 atualizada. Quota: Sem limite, Auto-Aprovação: Sim, Ativa: Sim.	2026-06-11 11:42:52.219896	9
2030	CLIENTE	144	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 11:42:52.289707	9
2031	UTILIZADOR	221	CRIACAO	Utilizador interno Técnico de Teste CRUD (tecnico.crud@laboratorio.pt) criado com perfil id #4.	2026-06-11 11:42:53.318331	120
2032	UTILIZADOR	221	EDICAO	Utilizador interno Técnico de Teste Editado atualizado (palavra-passe alterada). Ativo: Não.	2026-06-11 11:42:53.65187	120
2230	AUTORIZACAO	308	EDICAO	Regra de whitelist id #308 atualizada. Quota: Sem limite, Auto-Aprovação: Sim, Ativa: Sim.	2026-06-11 18:07:09.897279	9
2231	CLIENTE	152	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 18:07:09.980124	9
2232	UTILIZADOR	233	CRIACAO	Utilizador interno Técnico de Teste CRUD (tecnico.crud@laboratorio.pt) criado com perfil id #4.	2026-06-11 18:07:11.074624	120
2082	AMOSTRA	1	DISPONIBILIZAR	Boletim analítico disponibilizado para o cliente pela gestão.	2026-06-11 15:11:13.594907	120
2233	UTILIZADOR	233	EDICAO	Utilizador interno Técnico de Teste Editado atualizado (palavra-passe alterada). Ativo: Não.	2026-06-11 18:07:11.416525	120
2365	CLIENTE	158	CRIACAO	Cliente contratado Empresa Teste CRUD Lda registado no sistema.	2026-06-12 00:25:08.192794	9
2366	CLIENTE	158	ALTERACAO_STATUS	Estado da conta do cliente id #158 atualizado para inativo.	2026-06-12 00:25:08.593851	9
2367	CLIENTE	158	ALTERACAO_STATUS	Estado da conta do cliente id #158 atualizado para ativo.	2026-06-12 00:25:08.614008	9
2368	CLIENTE	158	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-12 00:25:08.629654	9
2369	AUTORIZACAO	323	CRIACAO	Regra de whitelist criada para cliente #158 na ETAR #2 com quota de 7 descargas/dia.	2026-06-12 00:25:08.801789	9
2370	AUTORIZACAO	324	CRIACAO	Regra de whitelist criada para cliente #158 na ETAR #3 com quota de Sem limite.	2026-06-12 00:25:08.822357	9
2371	AUTORIZACAO	323	EDICAO	Regra de whitelist id #323 atualizada. Quota: Sem limite, Auto-Aprovação: Sim, Ativa: Sim.	2026-06-12 00:25:08.844047	9
2372	CLIENTE	158	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-12 00:25:08.915939	9
2373	UTILIZADOR	242	CRIACAO	Utilizador interno Técnico de Teste CRUD (tecnico.crud@laboratorio.pt) criado com perfil id #4.	2026-06-12 00:25:09.959297	120
2374	UTILIZADOR	242	EDICAO	Utilizador interno Técnico de Teste Editado atualizado (palavra-passe alterada). Ativo: Não.	2026-06-12 00:25:10.296858	120
2130	CLIENTE	148	CRIACAO	Cliente contratado Empresa Teste CRUD Lda registado no sistema.	2026-06-11 15:51:50.527488	9
2131	CLIENTE	148	ALTERACAO_STATUS	Estado da conta do cliente id #148 atualizado para inativo.	2026-06-11 15:51:50.925254	9
2132	CLIENTE	148	ALTERACAO_STATUS	Estado da conta do cliente id #148 atualizado para ativo.	2026-06-11 15:51:50.941895	9
2133	CLIENTE	148	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 15:51:50.95956	9
2134	AUTORIZACAO	298	CRIACAO	Regra de whitelist criada para cliente #148 na ETAR #2 com quota de 7 descargas/dia.	2026-06-11 15:51:51.165383	9
2135	AUTORIZACAO	299	CRIACAO	Regra de whitelist criada para cliente #148 na ETAR #3 com quota de Sem limite.	2026-06-11 15:51:51.189612	9
2136	AUTORIZACAO	298	EDICAO	Regra de whitelist id #298 atualizada. Quota: Sem limite, Auto-Aprovação: Sim, Ativa: Sim.	2026-06-11 15:51:51.214613	9
2137	CLIENTE	148	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 15:51:51.286099	9
2138	UTILIZADOR	227	CRIACAO	Utilizador interno Técnico de Teste CRUD (tecnico.crud@laboratorio.pt) criado com perfil id #4.	2026-06-11 15:51:52.333065	120
2139	UTILIZADOR	227	EDICAO	Utilizador interno Técnico de Teste Editado atualizado (palavra-passe alterada). Ativo: Não.	2026-06-11 15:51:52.665052	120
2177	CLIENTE	150	CRIACAO	Cliente contratado Empresa Teste CRUD Lda registado no sistema.	2026-06-11 15:52:16.456217	9
2178	CLIENTE	150	ALTERACAO_STATUS	Estado da conta do cliente id #150 atualizado para inativo.	2026-06-11 15:52:16.832529	9
2179	CLIENTE	150	ALTERACAO_STATUS	Estado da conta do cliente id #150 atualizado para ativo.	2026-06-11 15:52:16.849962	9
2180	CLIENTE	150	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 15:52:16.869463	9
2181	AUTORIZACAO	303	CRIACAO	Regra de whitelist criada para cliente #150 na ETAR #2 com quota de 7 descargas/dia.	2026-06-11 15:52:17.053282	9
2182	AUTORIZACAO	304	CRIACAO	Regra de whitelist criada para cliente #150 na ETAR #3 com quota de Sem limite.	2026-06-11 15:52:17.073267	9
2183	AUTORIZACAO	303	EDICAO	Regra de whitelist id #303 atualizada. Quota: Sem limite, Auto-Aprovação: Sim, Ativa: Sim.	2026-06-11 15:52:17.093033	9
2184	CLIENTE	150	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-11 15:52:17.160667	9
2185	UTILIZADOR	230	CRIACAO	Utilizador interno Técnico de Teste CRUD (tecnico.crud@laboratorio.pt) criado com perfil id #4.	2026-06-11 15:52:18.203881	120
2186	UTILIZADOR	230	EDICAO	Utilizador interno Técnico de Teste Editado atualizado (palavra-passe alterada). Ativo: Não.	2026-06-11 15:52:18.537665	120
2271	CLIENTE	154	CRIACAO	Cliente contratado Empresa Teste CRUD Lda registado no sistema.	2026-06-12 00:06:22.415221	9
2272	CLIENTE	154	ALTERACAO_STATUS	Estado da conta do cliente id #154 atualizado para inativo.	2026-06-12 00:06:23.175619	9
2273	CLIENTE	154	ALTERACAO_STATUS	Estado da conta do cliente id #154 atualizado para ativo.	2026-06-12 00:06:23.209131	9
2274	CLIENTE	154	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-12 00:06:23.241449	9
2275	AUTORIZACAO	313	CRIACAO	Regra de whitelist criada para cliente #154 na ETAR #2 com quota de 7 descargas/dia.	2026-06-12 00:06:26.281068	9
2276	AUTORIZACAO	314	CRIACAO	Regra de whitelist criada para cliente #154 na ETAR #3 com quota de Sem limite.	2026-06-12 00:06:26.321025	9
2277	AUTORIZACAO	313	EDICAO	Regra de whitelist id #313 atualizada. Quota: Sem limite, Auto-Aprovação: Sim, Ativa: Sim.	2026-06-12 00:06:26.373035	9
2278	CLIENTE	154	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-12 00:06:26.487828	9
2279	UTILIZADOR	236	CRIACAO	Utilizador interno Técnico de Teste CRUD (tecnico.crud@laboratorio.pt) criado com perfil id #4.	2026-06-12 00:06:28.047876	120
2280	UTILIZADOR	236	EDICAO	Utilizador interno Técnico de Teste Editado atualizado (palavra-passe alterada). Ativo: Não.	2026-06-12 00:06:28.598345	120
2412	CLIENTE	160	CRIACAO	Cliente contratado Empresa Teste CRUD Lda registado no sistema.	2026-06-12 00:31:42.773728	9
2413	CLIENTE	160	ALTERACAO_STATUS	Estado da conta do cliente id #160 atualizado para inativo.	2026-06-12 00:31:43.185901	9
2414	CLIENTE	160	ALTERACAO_STATUS	Estado da conta do cliente id #160 atualizado para ativo.	2026-06-12 00:31:43.202242	9
2415	CLIENTE	160	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-12 00:31:43.21993	9
2416	AUTORIZACAO	328	CRIACAO	Regra de whitelist criada para cliente #160 na ETAR #2 com quota de 7 descargas/dia.	2026-06-12 00:31:43.386607	9
2417	AUTORIZACAO	329	CRIACAO	Regra de whitelist criada para cliente #160 na ETAR #3 com quota de Sem limite.	2026-06-12 00:31:43.409296	9
2318	CLIENTE	156	CRIACAO	Cliente contratado Empresa Teste CRUD Lda registado no sistema.	2026-06-12 00:12:02.714222	9
2319	CLIENTE	156	ALTERACAO_STATUS	Estado da conta do cliente id #156 atualizado para inativo.	2026-06-12 00:12:03.122989	9
2320	CLIENTE	156	ALTERACAO_STATUS	Estado da conta do cliente id #156 atualizado para ativo.	2026-06-12 00:12:03.140429	9
2321	CLIENTE	156	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-12 00:12:03.15958	9
2322	AUTORIZACAO	318	CRIACAO	Regra de whitelist criada para cliente #156 na ETAR #2 com quota de 7 descargas/dia.	2026-06-12 00:12:03.327204	9
2323	AUTORIZACAO	319	CRIACAO	Regra de whitelist criada para cliente #156 na ETAR #3 com quota de Sem limite.	2026-06-12 00:12:03.347559	9
2324	AUTORIZACAO	318	EDICAO	Regra de whitelist id #318 atualizada. Quota: Sem limite, Auto-Aprovação: Sim, Ativa: Sim.	2026-06-12 00:12:03.364868	9
2325	CLIENTE	156	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-12 00:12:03.435045	9
2326	UTILIZADOR	239	CRIACAO	Utilizador interno Técnico de Teste CRUD (tecnico.crud@laboratorio.pt) criado com perfil id #4.	2026-06-12 00:12:04.47127	120
2327	UTILIZADOR	239	EDICAO	Utilizador interno Técnico de Teste Editado atualizado (palavra-passe alterada). Ativo: Não.	2026-06-12 00:12:04.856942	120
2418	AUTORIZACAO	328	EDICAO	Regra de whitelist id #328 atualizada. Quota: Sem limite, Auto-Aprovação: Sim, Ativa: Sim.	2026-06-12 00:31:43.427138	9
2419	CLIENTE	160	EDICAO	Dados do cliente Empresa Teste Alterada atualizados no sistema.	2026-06-12 00:31:43.496359	9
2420	UTILIZADOR	245	CRIACAO	Utilizador interno Técnico de Teste CRUD (tecnico.crud@laboratorio.pt) criado com perfil id #4.	2026-06-12 00:31:44.544639	120
2421	UTILIZADOR	245	EDICAO	Utilizador interno Técnico de Teste Editado atualizado (palavra-passe alterada). Ativo: Não.	2026-06-12 00:31:44.923698	120
2459	DESCARGA	849	AUTORIZACAO	Pedido de descarga analisado e autorizada manualmente. Obs: Sem observações	2026-06-12 01:29:33.444056	120
2460	SISTEMA	0	ENVIO_AVISO_GERAL	Aviso Geral enviado a todos os utilizadores: "ETAR Algarve novamente disponível para descargas."	2026-06-12 01:32:11.878848	120
\.


--
-- TOC entry 5194 (class 0 OID 42071)
-- Dependencies: 240
-- Data for Name: notificacao; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notificacao (id_notificacao, id_utilizador, mensagem, tipo, enviada, lida, data) FROM stdin;
1	1	Descarga autorizada	DESCARGA	t	f	2026-06-07 22:45:25.59788
2	2	Descarga rejeitada	DESCARGA	t	f	2026-06-07 22:45:25.59788
3	3	Nova receção registada	SISTEMA	t	f	2026-06-07 22:45:25.59788
666	133	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
667	134	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
668	137	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
669	138	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
670	139	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
671	141	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
672	142	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
673	3	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
674	6	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
675	1	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
676	2	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
677	4	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
678	10	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
679	5	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
680	7	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
681	8	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
682	136	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
683	140	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
684	135	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
685	18	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
686	120	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
687	9	ETAR Algarve novamente disponível para descargas.	SISTEMA	t	f	2026-06-12 01:32:11.878848
\.


--
-- TOC entry 5182 (class 0 OID 41930)
-- Dependencies: 228
-- Data for Name: parametro; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.parametro (id_parametro, nome, tipo_parametro, unidade_default, obrigatorio, metodo_default_cod, metodo_default_nome, incerteza_default) FROM stdin;
1	pH	FISICO_QUIMICO	pH	t	SMEWW 4500-H+	Eletrometria	0.015
2	CQO	FISICO_QUIMICO	mg/L	t	SMEWW 5220 B	Refluxo Fechado / Titulometria	0.05
3	CBO5	FISICO_QUIMICO	mg/L	t	SMEWW 5210 B	Incubação / Eletrométrico	0.08
4	SST	FISICO_QUIMICO	mg/L	t	SMEWW 2540 D	Secagem a 103-105ºC / Gravimetria	0.10
5	Condutividade	FISICO_QUIMICO	mS/cm	t	SMEWW 2510 B	Condutimetria	0.05
26	Hidrocarbonetos	OLEOS E GORDURAS	mg/L	f	SMEWW 5520 F	Partição/Infravermelho ou Gravimetria	0.15
6	Azoto Kjeldahl	AZOTO / NUTRIENTES	mg/L	f	SMEWW 4500-N	Digestão / Destilação / Titulometria	0.06
7	Zinco	METAIS PESADOS	mg/L	f	SMEWW 3111 B	Espectrofotometria de Absorção Atómica (EAA)	0.05
\.


--
-- TOC entry 5174 (class 0 OID 41864)
-- Dependencies: 220
-- Data for Name: perfil; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.perfil (id_perfil, nome) FROM stdin;
1	CLIENTE
2	OPERADOR_ETAR
3	RESPONSAVEL_ETAR
4	TECNICO_LAB
5	RESPONSAVEL_LAB
6	GESTOR_CLIENTES
7	GESTOR_ADMIN
\.


--
-- TOC entry 5188 (class 0 OID 42005)
-- Dependencies: 234
-- Data for Name: resultado_analitico; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.resultado_analitico (id_resultado, id_amostra, id_parametro, valor, unidade, metodo, incerteza) FROM stdin;
520	2	1	7.8	pH	SMEWW 4500-H+	11
521	2	2	870	mg/L	SMEWW 5220 B	4
522	2	3	310	mg/L	SMEWW 5210 B	8
523	2	4	99	mg/L	SMEWW 2540 D	6
524	2	5	1.7	mS/cm	SMEWW 2510 B	10
525	2	6	25	mg/L	SMEWW 4500-N	5
83	29	1	8	pH	SMEWW 4500-H+	\N
84	29	2	456	mg/L	SMEWW 5220 B	\N
85	29	3	110	mg/L	SMEWW 5210 B	\N
86	29	4	89	mg/L	SMEWW 2540 D	\N
87	29	5	1.3	mS/cm	SMEWW 2510 B	\N
88	29	6	35.5	mg/L	SMEWW 4500-N	\N
149	49	1	8.8	pH	SMEWW 4500-H+	\N
150	49	2	1100	mg/L	SMEWW 5220 B	\N
151	49	3	200	mg/L	SMEWW 5210 B	\N
152	49	4	120	mg/L	SMEWW 2540 D	\N
153	49	5	1.89	mS/cm	SMEWW 2510 B	\N
598	44	1	9.2	pH	SMEWW 4500-H+	0.13799999999999998
599	44	2	550	mg/L	SMEWW 5220 B	27.5
600	44	3	231	mg/L	SMEWW 5210 B	18.48
601	44	4	111	mg/L	SMEWW 2540 D	11.100000000000001
602	44	5	1.4	mS/cm	SMEWW 2510 B	0.06999999999999999
603	44	6	28.6	mg/L	SMEWW 4500-N	1.716
52	1	1	9.5	pH	SMEWW 4500-H+	\N
53	1	2	1400	mg/L	SMEWW 5220 B	\N
54	1	3	350	mg/L	SMEWW 5210 B	\N
55	1	4	120	mg/L	SMEWW 2540 D	\N
56	1	5	2.3	mS/cm	SMEWW 2510 B	\N
57	1	6	99	mg/L	SMEWW 4500-N	\N
58	1	7	0.65	mg/L	SMEWW 3111 B	\N
\.


--
-- TOC entry 5176 (class 0 OID 41877)
-- Dependencies: 222
-- Data for Name: utilizador; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.utilizador (id_utilizador, id_perfil, nome, email, password_hash, ativo, id_etar) FROM stdin;
133	2	Bruno Nogueira	bruno.nogueira@etar.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	1
134	2	Diana Santos	diana.santos@etar.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	2
137	2	Igor Gomes	igor.gomes@etar.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	4
138	2	Joana Cruz	joana.cruz@etar.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	4
139	3	Eduardo Lima	eduardo.lima@etar.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	2
141	3	Katia Martins	katia.martins@etar.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	4
142	4	Pedro Sousa	pedro.sousa@laboratorio.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	\N
3	1	TransEfluentes Lda	logistica@transefluentes.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	\N
6	3	Fernando Rocha	fernando.rocha@etar.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	1
1	1	EmpresaIndustrialAAA SA	geral@empresaIndustrialaaa.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	\N
2	1	EmpresaIndustrialBBB SA	geral@empresaIndustrialbbb.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	\N
4	2	Carlos Silva	carlos.silva@etar.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	1
10	6	António Almeida	antonio.almeida@administracao.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	\N
5	2	José Teixeira	jose.teixeira@etar.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	2
7	4	Ana Pereira	ana.pereira@laboratorio.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	\N
8	5	Paula Melo	paula.melo@laboratorio.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	\N
136	2	Gabriela Vaz	gabriela.vaz@etar.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	3
140	3	Helder Monteiro	helder.monteiro@etar.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	3
135	2	Joaquim Abreu	joaquim.abreu@etar.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	3
18	1	EmpresaIndustrialCCC	mariana.Abreu@administracao.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	\N
120	7	Filipe Ferreira	filipe.ferreira@admin.entidadegestora.pt	$2b$12$QbE4uKgKYnKJ6jiWeTcl5usvjv6mB8zvffVoeuoA6W2oVdeieKBaK	t	\N
9	6	Mariana Costa	mariana.costa@administracao.pt	$2b$12$86HE9McQ6qD4AxHVtgVghewWNPA9bD.HFvrCrX3mnd60Lyv7l9tcW	t	\N
\.


--
-- TOC entry 5212 (class 0 OID 0)
-- Dependencies: 231
-- Name: amostra_id_amostra_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.amostra_id_amostra_seq', 210, true);


--
-- TOC entry 5213 (class 0 OID 0)
-- Dependencies: 235
-- Name: autorizacao_id_autorizacao_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.autorizacao_id_autorizacao_seq', 332, true);


--
-- TOC entry 5214 (class 0 OID 0)
-- Dependencies: 223
-- Name: cliente_id_cliente_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cliente_id_cliente_seq', 161, true);


--
-- TOC entry 5215 (class 0 OID 0)
-- Dependencies: 229
-- Name: descarga_id_descarga_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.descarga_id_descarga_seq', 962, true);


--
-- TOC entry 5216 (class 0 OID 0)
-- Dependencies: 225
-- Name: etar_id_etar_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.etar_id_etar_seq', 62, true);


--
-- TOC entry 5217 (class 0 OID 0)
-- Dependencies: 237
-- Name: historico_id_historico_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.historico_id_historico_seq', 2460, true);


--
-- TOC entry 5218 (class 0 OID 0)
-- Dependencies: 239
-- Name: notificacao_id_notificacao_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notificacao_id_notificacao_seq', 687, true);


--
-- TOC entry 5219 (class 0 OID 0)
-- Dependencies: 227
-- Name: parametro_id_parametro_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.parametro_id_parametro_seq', 64, true);


--
-- TOC entry 5220 (class 0 OID 0)
-- Dependencies: 219
-- Name: perfil_id_perfil_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.perfil_id_perfil_seq', 56, true);


--
-- TOC entry 5221 (class 0 OID 0)
-- Dependencies: 233
-- Name: resultado_analitico_id_resultado_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.resultado_analitico_id_resultado_seq', 657, true);


--
-- TOC entry 5222 (class 0 OID 0)
-- Dependencies: 221
-- Name: utilizador_id_utilizador_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.utilizador_id_utilizador_seq', 246, true);


--
-- TOC entry 4990 (class 2606 OID 41988)
-- Name: amostra amostra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amostra
    ADD CONSTRAINT amostra_pkey PRIMARY KEY (id_amostra);


--
-- TOC entry 4992 (class 2606 OID 42409)
-- Name: amostra amostra_qr_code_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amostra
    ADD CONSTRAINT amostra_qr_code_token_key UNIQUE (qr_code_token);


--
-- TOC entry 5000 (class 2606 OID 42039)
-- Name: autorizacao autorizacao_id_cliente_id_etar_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizacao
    ADD CONSTRAINT autorizacao_id_cliente_id_etar_key UNIQUE (id_cliente, id_etar);


--
-- TOC entry 5002 (class 2606 OID 42037)
-- Name: autorizacao autorizacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizacao
    ADD CONSTRAINT autorizacao_pkey PRIMARY KEY (id_autorizacao);


--
-- TOC entry 4976 (class 2606 OID 41911)
-- Name: cliente cliente_id_utilizador_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_id_utilizador_key UNIQUE (id_utilizador);


--
-- TOC entry 5008 (class 2606 OID 42381)
-- Name: cliente_parametro cliente_parametro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_parametro
    ADD CONSTRAINT cliente_parametro_pkey PRIMARY KEY (id_cliente, id_parametro);


--
-- TOC entry 4978 (class 2606 OID 41909)
-- Name: cliente cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_pkey PRIMARY KEY (id_cliente);


--
-- TOC entry 4986 (class 2606 OID 41958)
-- Name: descarga descarga_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descarga
    ADD CONSTRAINT descarga_pkey PRIMARY KEY (id_descarga);


--
-- TOC entry 4988 (class 2606 OID 42407)
-- Name: descarga descarga_qr_code_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descarga
    ADD CONSTRAINT descarga_qr_code_token_key UNIQUE (qr_code_token);


--
-- TOC entry 4980 (class 2606 OID 41928)
-- Name: etar etar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etar
    ADD CONSTRAINT etar_pkey PRIMARY KEY (id_etar);


--
-- TOC entry 5004 (class 2606 OID 42064)
-- Name: historico historico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico
    ADD CONSTRAINT historico_pkey PRIMARY KEY (id_historico);


--
-- TOC entry 5006 (class 2606 OID 42086)
-- Name: notificacao notificacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacao
    ADD CONSTRAINT notificacao_pkey PRIMARY KEY (id_notificacao);


--
-- TOC entry 4982 (class 2606 OID 41942)
-- Name: parametro parametro_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametro
    ADD CONSTRAINT parametro_nome_key UNIQUE (nome);


--
-- TOC entry 4984 (class 2606 OID 41940)
-- Name: parametro parametro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametro
    ADD CONSTRAINT parametro_pkey PRIMARY KEY (id_parametro);


--
-- TOC entry 4968 (class 2606 OID 41875)
-- Name: perfil perfil_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfil
    ADD CONSTRAINT perfil_nome_key UNIQUE (nome);


--
-- TOC entry 4970 (class 2606 OID 41873)
-- Name: perfil perfil_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfil
    ADD CONSTRAINT perfil_pkey PRIMARY KEY (id_perfil);


--
-- TOC entry 4996 (class 2606 OID 42015)
-- Name: resultado_analitico resultado_analitico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultado_analitico
    ADD CONSTRAINT resultado_analitico_pkey PRIMARY KEY (id_resultado);


--
-- TOC entry 4994 (class 2606 OID 49744)
-- Name: amostra uq_amostra_por_descarga; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amostra
    ADD CONSTRAINT uq_amostra_por_descarga UNIQUE (id_descarga);


--
-- TOC entry 4998 (class 2606 OID 49751)
-- Name: resultado_analitico uq_resultado_amostra_parametro; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultado_analitico
    ADD CONSTRAINT uq_resultado_amostra_parametro UNIQUE (id_amostra, id_parametro);


--
-- TOC entry 4972 (class 2606 OID 41892)
-- Name: utilizador utilizador_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilizador
    ADD CONSTRAINT utilizador_email_key UNIQUE (email);


--
-- TOC entry 4974 (class 2606 OID 41890)
-- Name: utilizador utilizador_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilizador
    ADD CONSTRAINT utilizador_pkey PRIMARY KEY (id_utilizador);


--
-- TOC entry 5015 (class 2606 OID 41989)
-- Name: amostra amostra_id_descarga_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amostra
    ADD CONSTRAINT amostra_id_descarga_fkey FOREIGN KEY (id_descarga) REFERENCES public.descarga(id_descarga);


--
-- TOC entry 5016 (class 2606 OID 41999)
-- Name: amostra amostra_id_responsavel_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amostra
    ADD CONSTRAINT amostra_id_responsavel_fkey FOREIGN KEY (id_responsavel) REFERENCES public.utilizador(id_utilizador);


--
-- TOC entry 5017 (class 2606 OID 41994)
-- Name: amostra amostra_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amostra
    ADD CONSTRAINT amostra_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.utilizador(id_utilizador);


--
-- TOC entry 5020 (class 2606 OID 42040)
-- Name: autorizacao autorizacao_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizacao
    ADD CONSTRAINT autorizacao_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.cliente(id_cliente);


--
-- TOC entry 5021 (class 2606 OID 42045)
-- Name: autorizacao autorizacao_id_etar_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizacao
    ADD CONSTRAINT autorizacao_id_etar_fkey FOREIGN KEY (id_etar) REFERENCES public.etar(id_etar);


--
-- TOC entry 5010 (class 2606 OID 41912)
-- Name: cliente cliente_id_utilizador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_id_utilizador_fkey FOREIGN KEY (id_utilizador) REFERENCES public.utilizador(id_utilizador);


--
-- TOC entry 5024 (class 2606 OID 42382)
-- Name: cliente_parametro cliente_parametro_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_parametro
    ADD CONSTRAINT cliente_parametro_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.cliente(id_cliente);


--
-- TOC entry 5025 (class 2606 OID 42387)
-- Name: cliente_parametro cliente_parametro_id_parametro_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_parametro
    ADD CONSTRAINT cliente_parametro_id_parametro_fkey FOREIGN KEY (id_parametro) REFERENCES public.parametro(id_parametro);


--
-- TOC entry 5011 (class 2606 OID 41959)
-- Name: descarga descarga_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descarga
    ADD CONSTRAINT descarga_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.cliente(id_cliente);


--
-- TOC entry 5012 (class 2606 OID 41964)
-- Name: descarga descarga_id_etar_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descarga
    ADD CONSTRAINT descarga_id_etar_fkey FOREIGN KEY (id_etar) REFERENCES public.etar(id_etar);


--
-- TOC entry 5013 (class 2606 OID 41969)
-- Name: descarga descarga_id_utilizador_decisao_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descarga
    ADD CONSTRAINT descarga_id_utilizador_decisao_fkey FOREIGN KEY (id_utilizador_decisao) REFERENCES public.utilizador(id_utilizador);


--
-- TOC entry 5014 (class 2606 OID 41974)
-- Name: descarga descarga_id_utilizador_rececao_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descarga
    ADD CONSTRAINT descarga_id_utilizador_rececao_fkey FOREIGN KEY (id_utilizador_rececao) REFERENCES public.utilizador(id_utilizador);


--
-- TOC entry 5023 (class 2606 OID 42087)
-- Name: notificacao fk_notificacao_utilizador; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacao
    ADD CONSTRAINT fk_notificacao_utilizador FOREIGN KEY (id_utilizador) REFERENCES public.utilizador(id_utilizador);


--
-- TOC entry 5022 (class 2606 OID 42065)
-- Name: historico historico_id_utilizador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico
    ADD CONSTRAINT historico_id_utilizador_fkey FOREIGN KEY (id_utilizador) REFERENCES public.utilizador(id_utilizador);


--
-- TOC entry 5018 (class 2606 OID 42016)
-- Name: resultado_analitico resultado_analitico_id_amostra_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultado_analitico
    ADD CONSTRAINT resultado_analitico_id_amostra_fkey FOREIGN KEY (id_amostra) REFERENCES public.amostra(id_amostra);


--
-- TOC entry 5019 (class 2606 OID 42021)
-- Name: resultado_analitico resultado_analitico_id_parametro_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultado_analitico
    ADD CONSTRAINT resultado_analitico_id_parametro_fkey FOREIGN KEY (id_parametro) REFERENCES public.parametro(id_parametro);


--
-- TOC entry 5009 (class 2606 OID 41893)
-- Name: utilizador utilizador_id_perfil_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilizador
    ADD CONSTRAINT utilizador_id_perfil_fkey FOREIGN KEY (id_perfil) REFERENCES public.perfil(id_perfil);


-- Completed on 2026-06-12 19:41:02

--
-- PostgreSQL database dump complete
--


