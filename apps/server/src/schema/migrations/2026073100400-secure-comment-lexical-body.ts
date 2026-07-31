import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE comments
      ADD COLUMN IF NOT EXISTS body_json jsonb,
      ADD COLUMN IF NOT EXISTS body_text text;

    DO $$
    DECLARE
      has_legacy_body boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'comments'
          AND column_name = 'body'
      )
      INTO has_legacy_body;

      IF has_legacy_body THEN
        EXECUTE $backfill$
          UPDATE comments
          SET
            body_text = coalesce(body_text, body, ''),
            body_json = coalesce(
              body_json,
              jsonb_build_object(
                'root',
                jsonb_build_object(
                  'children',
                  jsonb_build_array(
                    jsonb_build_object(
                      'children',
                      CASE
                        WHEN coalesce(body_text, body, '') = '' THEN '[]'::jsonb
                        ELSE jsonb_build_array(
                          jsonb_build_object(
                            'detail',
                            0,
                            'format',
                            0,
                            'mode',
                            'normal',
                            'style',
                            '',
                            'text',
                            coalesce(body_text, body, ''),
                            'type',
                            'text',
                            'version',
                            1
                          )
                        )
                      END,
                      'direction',
                      null,
                      'format',
                      '',
                      'indent',
                      0,
                      'type',
                      'paragraph',
                      'version',
                      1
                    )
                  ),
                  'direction',
                  null,
                  'format',
                  '',
                  'indent',
                  0,
                  'type',
                  'root',
                  'version',
                  1
                )
              )
            )
          WHERE body_json IS NULL OR body_text IS NULL
        $backfill$;
      ELSE
        UPDATE comments
        SET
          body_text = coalesce(body_text, ''),
          body_json = coalesce(
            body_json,
            jsonb_build_object(
              'root',
              jsonb_build_object(
                'children',
                jsonb_build_array(
                  jsonb_build_object(
                    'children',
                    CASE
                      WHEN coalesce(body_text, '') = '' THEN '[]'::jsonb
                      ELSE jsonb_build_array(
                        jsonb_build_object(
                          'detail',
                          0,
                          'format',
                          0,
                          'mode',
                          'normal',
                          'style',
                          '',
                          'text',
                          coalesce(body_text, ''),
                          'type',
                          'text',
                          'version',
                          1
                        )
                      )
                    END,
                    'direction',
                    null,
                    'format',
                    '',
                    'indent',
                    0,
                    'type',
                    'paragraph',
                    'version',
                    1
                  )
                ),
                'direction',
                null,
                'format',
                '',
                'indent',
                0,
                'type',
                'root',
                'version',
                1
              )
            )
          )
        WHERE body_json IS NULL OR body_text IS NULL;
      END IF;
    END $$;

    ALTER TABLE comments
      ALTER COLUMN body_json SET NOT NULL,
      ALTER COLUMN body_text SET NOT NULL,
      ALTER COLUMN body_format SET DEFAULT 'lexical';

    UPDATE comments
    SET body_format = 'lexical'
    WHERE body_format IS DISTINCT FROM 'lexical';

    ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_body_format_check;
    ALTER TABLE comments
      ADD CONSTRAINT comments_body_format_check CHECK (body_format IN ('lexical'));

    ALTER TABLE comments DROP COLUMN IF EXISTS body;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE comments
      ADD COLUMN IF NOT EXISTS body text;

    UPDATE comments
    SET body = coalesce(body_text, '')
    WHERE body IS NULL;

    ALTER TABLE comments
      ALTER COLUMN body SET NOT NULL,
      ALTER COLUMN body_format SET DEFAULT 'markdown';

    UPDATE comments
    SET body_format = 'markdown'
    WHERE body_format IS DISTINCT FROM 'markdown';

    ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_body_format_check;
    ALTER TABLE comments
      ADD CONSTRAINT comments_body_format_check CHECK (body_format IN ('markdown'));

    ALTER TABLE comments
      DROP COLUMN IF EXISTS body_json,
      DROP COLUMN IF EXISTS body_text;
  `.execute(db);
}
