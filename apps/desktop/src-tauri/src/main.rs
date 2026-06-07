#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    devthread_lib::run();
}
