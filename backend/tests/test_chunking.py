from app.utils.chunking import chunk_text, chunk_tabular_text


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

    def test_row_overlap_carries_forward(self):
        rows = "\n".join(f"row{i:03d}" for i in range(50))
        text = f"=== DIAPOSITIVA 1 ===\n{rows}"
        chunks = chunk_tabular_text(text, chunk_size=15, chunk_overlap=10)
        assert len(chunks) > 1
        # The last row of chunk N is carried forward as (part of) chunk N+1's start.
        for i in range(len(chunks) - 1):
            last_row_of_chunk = chunks[i]["content"].splitlines()[-1]
            assert last_row_of_chunk in chunks[i + 1]["content"].splitlines()
