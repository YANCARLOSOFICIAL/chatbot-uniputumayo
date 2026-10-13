from app.utils.chunking import chunk_text, chunk_tabular_text, chunk_normative_text, has_article_structure


class TestChunkText:
    def test_short_text_single_chunk(self):
        chunks = chunk_text("Hola, esta es una frase corta.", chunk_size=512, chunk_overlap=77)
        assert len(chunks) == 1
        assert chunks[0]["content"] == "Hola, esta es una frase corta."
        assert chunks[0]["token_count"] > 0

    def test_empty_text_no_chunks(self):
        assert chunk_text("   ", chunk_size=512, chunk_overlap=77) == []

    def test_long_text_splits_into_multiple_chunks(self):
        paragraph = "La Institución Universitaria del Putumayo ofrece programas académicos. " * 100
        chunks = chunk_text(paragraph, chunk_size=100, chunk_overlap=20)
        assert len(chunks) > 1
        for c in chunks:
            assert c["content"].strip() != ""

    def test_overlap_shares_content_between_adjacent_chunks(self):
        paragraph = "Frase numero uno. " * 200
        chunks = chunk_text(paragraph, chunk_size=50, chunk_overlap=15)
        assert len(chunks) > 1
        # Overlap means the end of one chunk reappears at the start of the next.
        tail = chunks[0]["content"][-20:]
        assert any(tail[:10] in chunks[i]["content"] for i in range(1, len(chunks)))

    def test_chunk_index_metadata_is_sequential(self):
        paragraph = "Contenido institucional. " * 200
        chunks = chunk_text(paragraph, chunk_size=50, chunk_overlap=10)
        indices = [c["metadata"]["chunk_index"] for c in chunks]
        assert indices == list(range(len(chunks)))


class TestChunkTabularText:
    def test_headerless_csv_chunks_by_row(self):
        text = "\n".join(f"fila{i},valor{i}" for i in range(5))
        chunks = chunk_tabular_text(text, chunk_size=512, chunk_overlap=77)
        assert len(chunks) == 1
        assert "fila0,valor0" in chunks[0]["content"]
        assert "fila4,valor4" in chunks[0]["content"]

    def test_section_header_repeated_on_every_chunk(self):
        rows = "\n".join(f"materia{i};creditos{i}" for i in range(60))
        text = f"=== HOJA: Pensum ===\n{rows}"
        chunks = chunk_tabular_text(text, chunk_size=30, chunk_overlap=5)
        assert len(chunks) > 1
        for c in chunks:
            assert c["content"].startswith("=== HOJA: Pensum ===")

    def test_never_splits_a_row_across_chunks(self):
        rows = "\n".join(f"fila-{i}-contenido-completo" for i in range(40))
        text = f"=== HOJA: Datos ===\n{rows}"
        chunks = chunk_tabular_text(text, chunk_size=20, chunk_overlap=5)
        all_content = "\n".join(c["content"] for c in chunks)
        for i in range(40):
            assert f"fila-{i}-contenido-completo" in all_content

    def test_multiple_sections_stay_isolated(self):
        text = (
            "=== HOJA: Semestre 1 ===\n"
            + "\n".join(f"materia{i}" for i in range(30))
            + "\n=== HOJA: Semestre 2 ===\n"
            + "\n".join(f"asignatura{i}" for i in range(30))
        )
        chunks = chunk_tabular_text(text, chunk_size=25, chunk_overlap=5)
        sem1_chunks = [c for c in chunks if "Semestre 1" in c["content"]]
        sem2_chunks = [c for c in chunks if "Semestre 2" in c["content"]]
        assert sem1_chunks and sem2_chunks
        for c in sem1_chunks:
            assert "asignatura" not in c["content"]
        for c in sem2_chunks:
            assert "materia" not in c["content"]

    def test_subheader_row_is_carried_across_every_split_chunk(self):
        # A merged-cell header (e.g. "SEMESTRE I") collapses to a single value
        # with no " | " separator once extracted — chunk_tabular_text must keep
        # labeling every chunk split out of that sub-section with it, not just
        # whichever one chunk happens to contain the header row itself.
        sem1_rows = "\n".join(f"TD10{i} | Materia uno {i} | 4 | TD10{i}" for i in range(10))
        sem2_rows = "\n".join(f"TD20{i} | Materia dos {i} | 3 | TD20{i}" for i in range(10))
        text = f"=== HOJA: Pensum ===\nSEMESTRE I\n{sem1_rows}\nSEMESTRE II\n{sem2_rows}"
        chunks = chunk_tabular_text(text, chunk_size=20, chunk_overlap=5)

        sem1_chunks = [c for c in chunks if "Materia uno" in c["content"]]
        sem2_chunks = [c for c in chunks if "Materia dos" in c["content"]]
        assert len(sem1_chunks) > 1
        assert len(sem2_chunks) > 1
        assert all("SEMESTRE I" in c["content"] for c in sem1_chunks)
        assert all("SEMESTRE II" in c["content"] for c in sem2_chunks)
        # SEMESTRE I's label must not bleed into SEMESTRE II's chunks.
        assert all("SEMESTRE II" not in c["content"] for c in sem1_chunks)

    def test_flat_list_among_multicolumn_rows_is_not_fragmented(self):
        # A section can mix multi-column course rows with a plain, headerless
        # list (e.g. an electives portfolio's name-only entries). A row with
        # no " | " is only a real sub-header when it introduces a
        # multi-column group right after it — a run of consecutive
        # single-column rows is just flat list content, not one sub-header
        # per line. Confirmed live on a real curriculum file: a 25-item
        # electives list turned into 25 separate one-line chunks before this.
        list_items = "\n".join(f"Electiva complementaria {i}" for i in range(25))
        text = (
            "=== HOJA: Pensum === \n"
            "CICLO TECNOLOGICO\n"
            "TD406 | 1 | Redes LAN\n"
            "ELECTIVAS COMPLEMENTARIAS\n"
            f"{list_items}"
        )
        chunks = chunk_tabular_text(text, chunk_size=512, chunk_overlap=77)
        list_chunks = [c for c in chunks if "Electiva complementaria 0" in c["content"]]
        assert len(list_chunks) == 1
        assert "Electiva complementaria 24" in list_chunks[0]["content"]

    def test_row_overlap_carries_forward(self):
        rows = "\n".join(f"row{i:03d}" for i in range(50))
        text = f"=== DIAPOSITIVA 1 ===\n{rows}"
        chunks = chunk_tabular_text(text, chunk_size=15, chunk_overlap=10)
        assert len(chunks) > 1
        # The last row of chunk N is carried forward as (part of) chunk N+1's start.
        for i in range(len(chunks) - 1):
            last_row_of_chunk = chunks[i]["content"].splitlines()[-1]
            assert last_row_of_chunk in chunks[i + 1]["content"].splitlines()


def _estatuto(n_articles=12, body="Texto del artículo con varias disposiciones. "):
    parts = ["ACUERDO No. 006 DE 2025. Por el cual se adopta el Estatuto Estudiantil. CONSIDERANDO que..."]
    for i in range(1, n_articles + 1):
        parts.append(f"ARTÍCULO {i}. TÍTULO DEL ARTÍCULO {i}. " + body * 3)
    return " ".join(parts)


class TestChunkNormativeText:
    # Live 2026-10-12 (ESTATUTO ESTUDIANTIL): "ARTÍCULO 54: FINALIDADES DE LAS
    # OPCIONES DE GRADO" closed one character-split chunk and the article that
    # lists the options opened the next, so no "opciones de grado" phrasing
    # retrieved the list. Whole-article chunks keep heading and body together.

    def test_detects_article_structure(self):
        assert has_article_structure(_estatuto(12))
        assert not has_article_structure("El tríptico menciona el ARTÍCULO 1 de la ley y nada más.")

    def test_each_article_starts_a_chunk_boundary_and_never_splits_mid_article(self):
        chunks = chunk_normative_text(_estatuto(12), chunk_size=120, chunk_overlap=10)
        assert len(chunks) > 1
        joined = [c["content"] for c in chunks]
        # every article heading appears exactly once, at the start of a line/chunk
        for i in range(1, 13):
            holders = [c for c in joined if f"ARTÍCULO {i}." in c]
            assert len(holders) == 1, f"ARTÍCULO {i} debe estar en un solo chunk"
        for c in chunks:
            assert c["metadata"]["chunking"] == "article"

    def test_small_consecutive_articles_are_packed_together(self):
        chunks = chunk_normative_text(_estatuto(12, body="Corto. "), chunk_size=512, chunk_overlap=10)
        assert len(chunks) < 12
        assert "ARTÍCULO 1." in chunks[0]["content"] and "ARTÍCULO 2." in chunks[0]["content"]

    def test_oversized_article_is_split_with_its_heading_repeated(self):
        long_article = "ARTÍCULO 12. OPCIONES DE GRADO. " + ("Pasantía, diplomado, artículo publicado. " * 120)
        text = _estatuto(11) + " " + long_article
        chunks = chunk_normative_text(text, chunk_size=100, chunk_overlap=10)
        pieces = [c["content"] for c in chunks if "OPCIONES DE GRADO" in c["content"]]
        assert len(pieces) > 1
        assert all(p.startswith("ARTÍCULO 12") for p in pieces)
        assert any("(continuación)" in p for p in pieces[1:])

    def test_page_header_noise_is_removed(self):
        text = _estatuto(12).replace("ARTÍCULO 6.", "C O N S E J O D I R E C T I V O P á g i n a 20 | 37 ARTÍCULO 6.")
        chunks = chunk_normative_text(text, chunk_size=512, chunk_overlap=10)
        assert not any("P á g i n a" in c["content"] for c in chunks)
        assert any("ARTÍCULO 6." in c["content"] for c in chunks)

    def test_falls_back_to_character_chunking_without_articles(self):
        text = "Párrafo normal. " * 300
        a = chunk_normative_text(text, chunk_size=100, chunk_overlap=10)
        b = chunk_text(text, chunk_size=100, chunk_overlap=10)
        assert [c["content"] for c in a] == [c["content"] for c in b]

    def test_cross_references_inside_an_article_do_not_split_it(self):
        text = _estatuto(12).replace(
            "ARTÍCULO 5. TÍTULO DEL ARTÍCULO 5. ",
            "ARTÍCULO 5. TÍTULO DEL ARTÍCULO 5. Según el ARTÍCULO 12 del presente estatuto y el ARTÍCULO 2, ",
        )
        chunks = chunk_normative_text(text, chunk_size=120, chunk_overlap=10)
        art5 = [c["content"] for c in chunks if "ARTÍCULO 5. TÍTULO" in c["content"]]
        assert len(art5) == 1
        assert "Según el ARTÍCULO 12 del presente estatuto" in art5[0]
        # ARTÍCULO 12 still opens its own chunk boundary later on
        assert sum(1 for c in chunks if "ARTÍCULO 12. TÍTULO" in c["content"]) == 1
