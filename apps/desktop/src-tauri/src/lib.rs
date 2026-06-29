mod repository;

use repository::{
    CreateAttachmentInput, CreateEntryInput, CreateFolderInput, CreateQuickLinkInput,
    CreateTaskInput, Database, MoveTaskInput, RenameFolderInput,
    UpdateEntryInput, UpdateQuickLinkInput, UpdateTaskInput,
};
use serde::Serialize;
use std::sync::OnceLock;
use std::time::Duration;
use tauri::Manager;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LinkMetadata {
    url: String,
    title: Option<String>,
    description: Option<String>,
    image_url: Option<String>,
    site_name: Option<String>,
}

#[tauri::command]
fn list_tasks(database: tauri::State<'_, Database>) -> Result<Vec<repository::Task>, String> {
    database.list_tasks().map_err(to_message)
}

#[tauri::command]
fn create_task(
    database: tauri::State<'_, Database>,
    input: CreateTaskInput,
) -> Result<repository::Task, String> {
    database.create_task(input).map_err(to_message)
}

#[tauri::command]
fn update_task(
    database: tauri::State<'_, Database>,
    input: UpdateTaskInput,
) -> Result<repository::Task, String> {
    database.update_task(input).map_err(to_message)
}

#[tauri::command]
fn move_task(
    database: tauri::State<'_, Database>,
    input: MoveTaskInput,
) -> Result<repository::Task, String> {
    database.move_task(input).map_err(to_message)
}

#[tauri::command]
fn delete_task(database: tauri::State<'_, Database>, id: String) -> Result<(), String> {
    database.delete_task(&id).map_err(to_message)
}

#[tauri::command]
fn list_folders(database: tauri::State<'_, Database>) -> Result<Vec<repository::Folder>, String> {
    database.list_folders().map_err(to_message)
}

#[tauri::command]
fn create_folder(
    database: tauri::State<'_, Database>,
    input: CreateFolderInput,
) -> Result<repository::Folder, String> {
    database.create_folder(input).map_err(to_message)
}

#[tauri::command]
fn rename_folder(
    database: tauri::State<'_, Database>,
    input: RenameFolderInput,
) -> Result<repository::Folder, String> {
    database.rename_folder(input).map_err(to_message)
}

#[tauri::command]
fn delete_folder(database: tauri::State<'_, Database>, id: String) -> Result<(), String> {
    database.delete_folder(&id).map_err(to_message)
}

#[tauri::command]
fn delete_folder_cascade(
    database: tauri::State<'_, Database>,
    id: String,
) -> Result<usize, String> {
    database.delete_folder_cascade(&id).map_err(to_message)
}

#[tauri::command]
fn unassign_folder_tasks(
    database: tauri::State<'_, Database>,
    id: String,
) -> Result<usize, String> {
    database.unassign_folder_tasks(&id).map_err(to_message)
}

#[tauri::command]
fn list_entries(
    database: tauri::State<'_, Database>,
    task_id: String,
    limit: u32,
    offset: u32,
) -> Result<Vec<repository::WorkLogEntry>, String> {
    database
        .list_entries(&task_id, limit.min(250), offset)
        .map_err(to_message)
}

#[tauri::command]
fn list_worklog_metrics(
    database: tauri::State<'_, Database>,
    start_at: Option<String>,
    end_at: Option<String>,
) -> Result<Vec<repository::WorklogMetricEntry>, String> {
    database
        .list_worklog_metrics(start_at, end_at)
        .map_err(to_message)
}

#[tauri::command]
fn list_global_timeline(
    database: tauri::State<'_, Database>,
    start_at: Option<String>,
    end_at: Option<String>,
    limit: u32,
) -> Result<Vec<repository::GlobalTimelineEntry>, String> {
    database
        .list_global_timeline(start_at, end_at, limit)
        .map_err(to_message)
}

#[tauri::command]
fn create_entry(
    database: tauri::State<'_, Database>,
    input: CreateEntryInput,
) -> Result<repository::WorkLogEntry, String> {
    database.create_entry(input).map_err(to_message)
}

#[tauri::command]
fn update_entry(
    database: tauri::State<'_, Database>,
    input: UpdateEntryInput,
) -> Result<repository::WorkLogEntry, String> {
    database.update_entry(input).map_err(to_message)
}

#[tauri::command]
fn list_revisions(
    database: tauri::State<'_, Database>,
    entry_id: String,
) -> Result<Vec<repository::WorkLogRevision>, String> {
    database.list_revisions(&entry_id).map_err(to_message)
}

#[tauri::command]
fn restore_revision(
    database: tauri::State<'_, Database>,
    revision_id: String,
) -> Result<repository::WorkLogEntry, String> {
    database.restore_revision(&revision_id).map_err(to_message)
}

#[tauri::command]
fn trash_entry(database: tauri::State<'_, Database>, entry_id: String) -> Result<(), String> {
    database.trash_entry(&entry_id).map_err(to_message)
}

#[tauri::command]
fn restore_entry(database: tauri::State<'_, Database>, entry_id: String) -> Result<(), String> {
    database.restore_entry(&entry_id).map_err(to_message)
}

#[tauri::command]
fn list_attachments(
    database: tauri::State<'_, Database>,
    task_id: String,
) -> Result<Vec<repository::Attachment>, String> {
    database.list_attachments(&task_id).map_err(to_message)
}

#[tauri::command]
fn create_attachment(
    database: tauri::State<'_, Database>,
    input: CreateAttachmentInput,
) -> Result<repository::Attachment, String> {
    database.create_attachment(input).map_err(to_message)
}

#[tauri::command]
fn list_quick_links(
    database: tauri::State<'_, Database>,
    task_id: String,
) -> Result<Vec<repository::TaskQuickLink>, String> {
    database.list_quick_links(&task_id).map_err(to_message)
}

#[tauri::command]
fn create_quick_link(
    database: tauri::State<'_, Database>,
    input: CreateQuickLinkInput,
) -> Result<repository::TaskQuickLink, String> {
    database.create_quick_link(input).map_err(to_message)
}

#[tauri::command]
fn update_quick_link(
    database: tauri::State<'_, Database>,
    input: UpdateQuickLinkInput,
) -> Result<repository::TaskQuickLink, String> {
    database.update_quick_link(input).map_err(to_message)
}

#[tauri::command]
fn delete_quick_link(database: tauri::State<'_, Database>, id: String) -> Result<(), String> {
    database.delete_quick_link(&id).map_err(to_message)
}

const PREVIEW_BODY_LIMIT: usize = 256 * 1024;
const PREVIEW_TIMEOUT: Duration = Duration::from_secs(5);
const PREVIEW_USER_AGENT: &str =
    "Mozilla/5.0 (compatible; DevThread/0.1; +https://devthread.local) link-preview";

fn preview_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(PREVIEW_TIMEOUT)
            .connect_timeout(Duration::from_secs(3))
            .user_agent(PREVIEW_USER_AGENT)
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

async fn read_bounded_body(response: reqwest::Response) -> Result<String, String> {
    use futures_util::StreamExt;

    let mut stream = response.bytes_stream();
    let mut buffer: Vec<u8> = Vec::with_capacity(PREVIEW_BODY_LIMIT);
    let mut truncated = false;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| "Could not read link preview.".to_owned())?;
        let remaining = PREVIEW_BODY_LIMIT.saturating_sub(buffer.len());
        if chunk.len() >= remaining {
            buffer.extend_from_slice(&chunk[..remaining]);
            truncated = true;
            break;
        } else {
            buffer.extend_from_slice(&chunk);
        }
    }
    if truncated {
        log::debug!("link preview body truncated at {} bytes", PREVIEW_BODY_LIMIT);
    }
    Ok(String::from_utf8_lossy(&buffer).into_owned())
}

#[tauri::command]
async fn fetch_link_preview(url: String) -> Result<LinkMetadata, String> {
    let parsed = reqwest::Url::parse(&url).map_err(|_| "Invalid preview URL.".to_owned())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only web links can be previewed.".into());
    }

    let response = preview_client()
        .get(parsed.clone())
        .send()
        .await
        .map_err(|_| "Could not load link preview.".to_owned())?;

    if !response.status().is_success() {
        return Err("Could not load link preview.".into());
    }

    let final_url = response.url().clone();
    let html = read_bounded_body(response).await?;

    let title = meta_content(&html, "property", "og:title")
        .or_else(|| meta_content(&html, "name", "twitter:title"))
        .or_else(|| title_content(&html));
    let description = meta_content(&html, "property", "og:description")
        .or_else(|| meta_content(&html, "name", "description"))
        .or_else(|| meta_content(&html, "name", "twitter:description"));
    let image_url = meta_content(&html, "property", "og:image")
        .or_else(|| meta_content(&html, "property", "og:image:url"))
        .or_else(|| meta_content(&html, "name", "twitter:image"))
        .and_then(|image| resolve_preview_url(&final_url, &image))
        .or_else(|| youtube_thumbnail_url(&final_url));
    let site_name = meta_content(&html, "property", "og:site_name");

    Ok(LinkMetadata {
        url: final_url.to_string(),
        title,
        description,
        image_url,
        site_name,
    })
}

#[tauri::command]
fn list_releases(database: tauri::State<'_, Database>) -> Result<Vec<repository::Release>, String> {
    database.list_releases().map_err(to_message)
}

#[tauri::command]
fn create_release(
    database: tauri::State<'_, Database>,
    input: repository::CreateReleaseInput,
) -> Result<repository::Release, String> {
    database.create_release(input).map_err(to_message)
}

#[tauri::command]
fn update_release(
    database: tauri::State<'_, Database>,
    input: repository::UpdateReleaseInput,
) -> Result<repository::Release, String> {
    database.update_release(input).map_err(to_message)
}

#[tauri::command]
fn delete_release(database: tauri::State<'_, Database>, name: String) -> Result<(), String> {
    database.delete_release(&name).map_err(to_message)
}

#[tauri::command]
fn tag_task_release(
    database: tauri::State<'_, Database>,
    task_id: String,
    name: String,
) -> Result<(), String> {
    database.tag_task_release(&task_id, &name).map_err(to_message)
}

#[tauri::command]
fn remove_task_release(
    database: tauri::State<'_, Database>,
    task_id: String,
) -> Result<(), String> {
    database.remove_task_release(&task_id).map_err(to_message)
}

#[tauri::command]
fn tag_folder_release(
    database: tauri::State<'_, Database>,
    folder_id: String,
    name: String,
) -> Result<(), String> {
    database.tag_folder_release(&folder_id, &name).map_err(to_message)
}

#[tauri::command]
fn remove_folder_release(
    database: tauri::State<'_, Database>,
    folder_id: String,
) -> Result<(), String> {
    database.remove_folder_release(&folder_id).map_err(to_message)
}

fn to_message(error: repository::RepositoryError) -> String {
    log::error!("database operation failed: {}", error.redacted());
    error.to_string()
}

fn meta_content(html: &str, key_attribute: &str, key_value: &str) -> Option<String> {
    let key_value_lower = key_value.to_ascii_lowercase();
    for tag in meta_tags(html) {
        let Some(key) = attr_value(tag, key_attribute) else {
            continue;
        };
        if key.to_ascii_lowercase() == key_value_lower {
            return attr_value(tag, "content").and_then(clean_html_value);
        }
    }
    None
}

fn meta_tags(html: &str) -> impl Iterator<Item = &str> {
    html.match_indices('<').filter_map(|(start, _)| {
        let rest = &html[start..];
        if rest.len() < 5 || !rest[..5].eq_ignore_ascii_case("<meta") {
            return None;
        }
        let end = rest.find('>')?;
        Some(&rest[..=end])
    })
}

fn attr_value(tag: &str, name: &str) -> Option<String> {
    let tag_bytes = tag.as_bytes();
    let name_lower = name.to_ascii_lowercase();
    let mut index = 0;

    while index < tag_bytes.len() {
        while index < tag_bytes.len() && tag_bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        let attr_start = index;
        while index < tag_bytes.len()
            && (tag_bytes[index].is_ascii_alphanumeric()
                || matches!(tag_bytes[index], b'-' | b':' | b'_'))
        {
            index += 1;
        }
        if attr_start == index {
            index += 1;
            continue;
        }
        let attr_name = tag[attr_start..index].to_ascii_lowercase();
        while index < tag_bytes.len() && tag_bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        if index >= tag_bytes.len() || tag_bytes[index] != b'=' {
            continue;
        }
        index += 1;
        while index < tag_bytes.len() && tag_bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        if index >= tag_bytes.len() {
            break;
        }

        let quote = tag_bytes[index];
        let value = if quote == b'"' || quote == b'\'' {
            index += 1;
            let value_start = index;
            while index < tag_bytes.len() && tag_bytes[index] != quote {
                index += 1;
            }
            tag[value_start..index].to_owned()
        } else {
            let value_start = index;
            while index < tag_bytes.len()
                && !tag_bytes[index].is_ascii_whitespace()
                && tag_bytes[index] != b'>'
            {
                index += 1;
            }
            tag[value_start..index].to_owned()
        };

        if attr_name == name_lower {
            return Some(value);
        }
    }

    None
}

fn title_content(html: &str) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let start = lower.find("<title")?;
    let after_open = lower[start..].find('>')? + start + 1;
    let end = lower[after_open..].find("</title>")? + after_open;
    clean_html_value(html[after_open..end].to_owned())
}

fn clean_html_value(value: String) -> Option<String> {
    let decoded = value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">");
    let clean = decoded.split_whitespace().collect::<Vec<_>>().join(" ");
    (!clean.is_empty()).then_some(clean)
}

fn resolve_preview_url(base: &reqwest::Url, value: &str) -> Option<String> {
    let parsed = base.join(value).ok()?;
    matches!(parsed.scheme(), "http" | "https").then(|| parsed.to_string())
}

fn youtube_thumbnail_url(url: &reqwest::Url) -> Option<String> {
    let host = url.host_str()?.trim_start_matches("www.");
    let video_id = if host == "youtu.be" {
        url.path_segments()?.next()?.to_owned()
    } else if host == "youtube.com" || host == "m.youtube.com" {
        url.query_pairs()
            .find_map(|(key, value)| (key == "v").then(|| value.into_owned()))?
    } else {
        return None;
    };

    let clean_id: String = video_id
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-'))
        .take(32)
        .collect();
    (!clean_id.is_empty()).then(|| format!("https://i.ytimg.com/vi/{clean_id}/hqdefault.jpg"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn meta_content_skips_unrelated_tags_before_open_graph_image() {
        let html = r#"
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta property="og:image" content="https://aivoid.dev/images/generated/kubelet-metrics-collection-internals.png">
        "#;

        assert_eq!(
            meta_content(html, "property", "og:image").as_deref(),
            Some("https://aivoid.dev/images/generated/kubelet-metrics-collection-internals.png")
        );
    }

    #[test]
    fn meta_content_handles_uppercase_tags_and_relative_preview_urls() {
        let html = r#"
            <META NAME="twitter:image" CONTENT="/images/preview.png">
        "#;
        let base = reqwest::Url::parse("https://devthread.test/posts/example/").unwrap();
        let image = meta_content(html, "name", "twitter:image")
            .and_then(|value| resolve_preview_url(&base, &value));

        assert_eq!(
            image.as_deref(),
            Some("https://devthread.test/images/preview.png")
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let database = Database::open(data_dir.join("devthread.sqlite3"))
                .map_err(|error| error.redacted())?;
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_tasks,
            create_task,
            update_task,
            move_task,
            delete_task,
            list_folders,
            create_folder,
            rename_folder,
            delete_folder,
            delete_folder_cascade,
            unassign_folder_tasks,
            list_entries,
            list_worklog_metrics,
            list_global_timeline,
            create_entry,
            update_entry,
            list_revisions,
            restore_revision,
            trash_entry,
            restore_entry,
            list_attachments,
            create_attachment,
            list_quick_links,
            create_quick_link,
            update_quick_link,
            delete_quick_link,
            fetch_link_preview,
            list_releases,
            create_release,
            update_release,
            delete_release,
            tag_task_release,
            remove_task_release,
            tag_folder_release,
            remove_folder_release
        ])
        .run(tauri::generate_context!())
        .expect("failed to run DevThread");
}
