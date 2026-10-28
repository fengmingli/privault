pub mod crypto;
pub mod error;
pub mod metadata;
pub mod model;
pub mod storage;
pub mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Privault UI prototype");
}
