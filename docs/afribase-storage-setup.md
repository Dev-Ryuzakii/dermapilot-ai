# Private scan snapshots in Afribase

The app uses the private `scan-snapshots` Storage bucket for each user's scan photo and YouCam spotted-area overlays. The bucket and owner-only `INSERT` and `SELECT` policies are now configured in this project. Afribase hides private bucket metadata from the anon key, so an API `getBucket` check cannot be used to decide whether the bucket exists.

In the Afribase project dashboard, select the project whose URL is configured as `AFRIBASE_URL` in `.env.local`:

1. Under **Project Settings → Service Management**, make sure **Storage** is enabled and refreshed. It is currently responding for this project.
2. Under **Storage**, verify `scan-snapshots` is **Private**. It is currently private.
3. Under **Auth Policies**, select the **storage** schema and **objects** table. The `scan-snapshots_insert_own` and `scan-snapshots_read_own` policies should exist for **Authenticated** users with `bucket_id = 'scan-snapshots' AND (foldername(name))[1] = uid()::text`. This matches this project's existing owner-only `catalog-images` policies and restricts access to the signed-in user's folder. Do not make the bucket public.
4. Take a new scan. On older results, choose **Save these snapshots privately** while their YouCam links still work.

The app stores objects under `<user-id>/<assessment-id>/`. It serves them through `/api/scan-image` after checking that the signed-in user owns the assessment. Failed storage saves leave the scan scores intact and show an explanation on the results page.

Afribase's [Storage documentation](https://useafribase.app/docs/storage) covers enabling the service, private buckets, and policies.
