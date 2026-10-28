#[cfg(unix)]
mod unix;
#[cfg(windows)]
mod windows;

#[cfg(unix)]
pub use unix::{secure_directory, SystemVolumeInspector};
#[cfg(windows)]
pub use windows::{secure_directory, SystemVolumeInspector};
